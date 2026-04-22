export interface Env {
  DB: D1Database;
  COOKIE_NAME: string;
  TURNSTILE_SECRET: string;
  DATA_TTL_DAYS: string;
  BYPASS_TURNSTILE?: string;
  SESSION_HASH_SALT?: string;
}

type VoteOption = "A" | "B";
const MAX_CLOSE_MINUTES = 60 * 24 * 3;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }));

    try {
      if (request.method === "GET" && url.pathname === "/api/v1/health") {
        return withCors(json({ ok: true, now: new Date().toISOString() }));
      }
      if (request.method === "POST" && url.pathname === "/api/v1/sessions/init") return withCors(await initSession(env));
      if (request.method === "POST" && url.pathname === "/api/v1/polls") return withCors(await createPoll(request, env));
      if (request.method === "GET" && url.pathname === "/api/v1/polls/next") return withCors(await getNextPoll(request, env));
      if (request.method === "GET" && url.pathname === "/api/v1/polls/mine") return withCors(await getMyPolls(request, env));

      const voteMatch = url.pathname.match(/^\/api\/v1\/polls\/([^/]+)\/vote$/);
      if (request.method === "POST" && voteMatch) return withCors(await votePoll(request, env, voteMatch[1]));

      const resultMatch = url.pathname.match(/^\/api\/v1\/polls\/([^/]+)\/result$/);
      if (request.method === "GET" && resultMatch) return withCors(await getPollResult(env, resultMatch[1]));

      const closeMatch = url.pathname.match(/^\/api\/v1\/polls\/([^/]+)\/close$/);
      if (request.method === "POST" && closeMatch) return withCors(await closePoll(request, env, closeMatch[1]));

      return withCors(json({ error: "Not found" }, 404));
    } catch (e) {
      console.error(e);
      return withCors(json({ error: "Internal server error" }, 500));
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await runDataCleanup(env);
  },
};

async function initSession(env: Env): Promise<Response> {
  const now = new Date();
  const ttlDays = Number(env.DATA_TTL_DAYS || "30");
  const expires = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  const sessionId = crypto.randomUUID();

  await env.DB.prepare(`INSERT INTO sessions (id, created_at, last_seen_at, expires_at) VALUES (?1, ?2, ?2, ?3)`)
    .bind(sessionId, now.toISOString(), expires.toISOString()).run();

  const response = json({ session_id: sessionId, expires_in_days: ttlDays });
  response.headers.append("Set-Cookie", `${env.COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires.toUTCString()}`);
  return response;
}

async function createPoll(request: Request, env: Env): Promise<Response> {
  const payload = await request.json<any>();
  if (env.BYPASS_TURNSTILE !== "true") {
    if (!payload.turnstile_token) return json({ error: "turnstile_token is required" }, 400);
    const isHuman = await verifyTurnstile(payload.turnstile_token, env);
    if (!isHuman) return json({ error: "Turnstile verification failed" }, 403);
  }

  const title = (payload.title ?? "").trim();
  const optionA = (payload.option_a ?? "").trim();
  const optionB = (payload.option_b ?? "").trim();
  const closeInMinutes = Number(payload.close_in_minutes);

  if (title.length < 1 || title.length > 60) return json({ error: "title must be 1-60 chars" }, 400);
  if (optionA.length < 1 || optionA.length > 30) return json({ error: "option_a must be 1-30 chars" }, 400);
  if (optionB.length < 1 || optionB.length > 30) return json({ error: "option_b must be 1-30 chars" }, 400);
  if (!Number.isInteger(closeInMinutes) || closeInMinutes < 1 || closeInMinutes > MAX_CLOSE_MINUTES) {
    return json({ error: "close_in_minutes must be between 1 and 4320" }, 400);
  }

  const sessionId = getSessionId(request, env.COOKIE_NAME);
  const creatorHash = sessionId ? await hashSession(sessionId, env) : null;

  const now = new Date();
  const closesAt = new Date(now.getTime() + closeInMinutes * 60000);
  const pollId = `p_${crypto.randomUUID()}`;

  await env.DB.prepare(
    `INSERT INTO polls (id, title, option_a, option_b, created_at, closes_at, status, creator_session_hash)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'open', ?7)`
  ).bind(pollId, title, optionA, optionB, now.toISOString(), closesAt.toISOString(), creatorHash).run();

  return json({ poll_id: pollId, created_at: now.toISOString(), closes_at: closesAt.toISOString() }, 201);
}

async function getNextPoll(request: Request, env: Env): Promise<Response> {
  const sessionId = getSessionId(request, env.COOKIE_NAME);
  const now = new Date().toISOString();
  const query = sessionId
    ? `SELECT p.id, p.title, p.option_a, p.option_b, p.closes_at FROM polls p WHERE p.closes_at > ?1 AND NOT EXISTS (SELECT 1 FROM votes v WHERE v.poll_id=p.id AND v.session_hash=?2) AND (p.creator_session_hash IS NULL OR p.creator_session_hash != ?2) ORDER BY RANDOM() LIMIT 1`
    : `SELECT id, title, option_a, option_b, closes_at FROM polls WHERE closes_at > ?1 ORDER BY RANDOM() LIMIT 1`;

  const stmt = env.DB.prepare(query);
  const result = sessionId ? await stmt.bind(now, await hashSession(sessionId, env)).first() : await stmt.bind(now).first();
  if (!result) return new Response(null, { status: 204 });
  return json({ poll: result });
}

async function votePoll(request: Request, env: Env, pollId: string): Promise<Response> {
  const sessionId = getSessionId(request, env.COOKIE_NAME);
  if (!sessionId) return json({ error: "session is required" }, 401);

  const payload = await request.json<{ selected_option?: VoteOption }>();
  if (payload.selected_option !== "A" && payload.selected_option !== "B") return json({ error: "selected_option must be A or B" }, 400);

  const poll = await env.DB.prepare(`SELECT closes_at FROM polls WHERE id = ?1`).bind(pollId).first<{ closes_at: string }>();
  if (!poll) return json({ error: "poll not found" }, 404);
  if (new Date(poll.closes_at).getTime() <= Date.now()) return json({ error: "poll closed" }, 410);

  try {
    await env.DB.prepare(`INSERT INTO votes (id, poll_id, session_hash, selected_option, created_at) VALUES (?1, ?2, ?3, ?4, ?5)`)
      .bind(`v_${crypto.randomUUID()}`, pollId, await hashSession(sessionId, env), payload.selected_option, new Date().toISOString()).run();
  } catch {
    return json({ error: "already voted" }, 409);
  }

  const result = await aggregateResult(env, pollId);
  return json({ poll_id: pollId, selected_option: payload.selected_option, result });
}

async function getMyPolls(request: Request, env: Env): Promise<Response> {
  const sessionId = getSessionId(request, env.COOKIE_NAME);
  if (!sessionId) return json({ polls: [] });
  const hash = await hashSession(sessionId, env);
  const rows = await env.DB.prepare(
    `SELECT id, title, option_a, option_b, closes_at,
       (SELECT COUNT(*) FROM votes WHERE poll_id=polls.id) as total_votes,
       (SELECT COUNT(*) FROM votes WHERE poll_id=polls.id AND selected_option='A') as votes_a,
       (SELECT COUNT(*) FROM votes WHERE poll_id=polls.id AND selected_option='B') as votes_b
     FROM polls WHERE creator_session_hash=?1 ORDER BY created_at DESC LIMIT 50`
  ).bind(hash).all<{
    id: string; title: string; option_a: string; option_b: string;
    closes_at: string; total_votes: number; votes_a: number; votes_b: number;
  }>();
  const polls = (rows.results ?? []).map((p) => ({
    ...p,
    closed: new Date(p.closes_at).getTime() <= Date.now(),
    percent_a: p.total_votes === 0 ? 0 : Number(((p.votes_a / p.total_votes) * 100).toFixed(1)),
    percent_b: p.total_votes === 0 ? 0 : Number(((p.votes_b / p.total_votes) * 100).toFixed(1)),
  }));
  return json({ polls });
}

async function getPollResult(env: Env, pollId: string): Promise<Response> {
  const poll = await env.DB.prepare(`SELECT closes_at FROM polls WHERE id = ?1`).bind(pollId).first<{ closes_at: string }>();
  if (!poll) return json({ error: "poll not found" }, 404);
  const result = await aggregateResult(env, pollId);
  return json({ poll_id: pollId, result, closed: new Date(poll.closes_at).getTime() <= Date.now() });
}

async function closePoll(request: Request, env: Env, pollId: string): Promise<Response> {
  const sessionId = getSessionId(request, env.COOKIE_NAME);
  if (!sessionId) return json({ error: "session is required" }, 401);

  const poll = await env.DB.prepare(`SELECT creator_session_hash, closes_at FROM polls WHERE id = ?1`)
    .bind(pollId).first<{ creator_session_hash: string | null; closes_at: string }>();
  if (!poll) return json({ error: "poll not found" }, 404);
  if (new Date(poll.closes_at).getTime() <= Date.now()) return json({ error: "already closed" }, 410);

  const requesterHash = await hashSession(sessionId, env);
  if (!poll.creator_session_hash || poll.creator_session_hash !== requesterHash) {
    return json({ error: "forbidden" }, 403);
  }

  const now = new Date().toISOString();
  await env.DB.prepare(`UPDATE polls SET closes_at = ?1 WHERE id = ?2`).bind(now, pollId).run();

  return json({ poll_id: pollId, closed_at: now });
}

async function aggregateResult(env: Env, pollId: string) {
  const row = await env.DB.prepare(
    `SELECT SUM(CASE WHEN selected_option='A' THEN 1 ELSE 0 END) as votes_a,
            SUM(CASE WHEN selected_option='B' THEN 1 ELSE 0 END) as votes_b,
            COUNT(*) as total_votes FROM votes WHERE poll_id=?1`
  ).bind(pollId).first<{ votes_a: number | null; votes_b: number | null; total_votes: number }>();

  const votesA = row?.votes_a ?? 0, votesB = row?.votes_b ?? 0, total = row?.total_votes ?? 0;
  return {
    votes_a: votesA, votes_b: votesB, total_votes: total,
    percent_a: total === 0 ? 0 : Number(((votesA / total) * 100).toFixed(1)),
    percent_b: total === 0 ? 0 : Number(((votesB / total) * 100).toFixed(1)),
  };
}

async function verifyTurnstile(token: string, env: Env): Promise<boolean> {
  const body = new URLSearchParams();
  body.set("secret", env.TURNSTILE_SECRET);
  body.set("response", token);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  if (!response.ok) return false;
  const data = await response.json<{ success?: boolean }>();
  return Boolean(data.success);
}

function getSessionId(request: Request, cookieName: string): string | null {
  const header = request.headers.get("X-Session-ID");
  if (header) return header;
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  const pair = cookie.split(";").map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`));
  return pair ? pair.split("=").slice(1).join("=") : null;
}

async function hashSession(sessionId: string, env: Env): Promise<string> {
  const src = `${env.SESSION_HASH_SALT ?? "docchi-default-salt"}:${sessionId}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(src));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function runDataCleanup(env: Env): Promise<void> {
  const ttlDays = Number(env.DATA_TTL_DAYS || "30");
  const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  await env.DB.prepare(`DELETE FROM votes WHERE created_at <= ?1`).bind(cutoff).run();
  await env.DB.prepare(`DELETE FROM polls WHERE created_at <= ?1`).bind(cutoff).run();
  await env.DB.prepare(`DELETE FROM sessions WHERE expires_at <= ?1`).bind(now).run();
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
function withCors(response: Response): Response {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Session-ID");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  return response;
}
