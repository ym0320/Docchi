import type { Poll, PollResult, VoteOption } from "./types";

const DEFAULT_API_BASE = "https://docchi-api.yuunakanaka-miruku.workers.dev/api/v1";

let sessionId: string | null = null;

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_API_BASE;
  if (trimmed.endsWith("/api/v1")) return trimmed;
  return `${trimmed}/api/v1`;
}

function sessionHeaders(): Record<string, string> {
  return sessionId ? { "X-Session-ID": sessionId } : {};
}

export function createApi(baseUrl: string) {
  const API_BASE = normalizeBaseUrl(baseUrl || DEFAULT_API_BASE);

  return {
    initSession: async () => {
      if (sessionId) return;
      const response = await fetch(`${API_BASE}/sessions/init`, { method: "POST" });
      if (!response.ok) throw new Error("セッション初期化に失敗しました");
      const data = await response.json() as { session_id: string };
      sessionId = data.session_id;
    },
    fetchNextPoll: async (): Promise<Poll | null> => {
      const response = await fetch(`${API_BASE}/polls/next`, {
        method: "GET",
        headers: sessionHeaders(),
      });
      if (response.status === 204) return null;
      if (!response.ok) throw new Error("投票の取得に失敗しました");
      const data = await response.json() as { poll: Poll };
      return data.poll;
    },
    votePoll: async (pollId: string, selected: VoteOption): Promise<PollResult> => {
      const response = await fetch(`${API_BASE}/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sessionHeaders() },
        body: JSON.stringify({ selected_option: selected }),
      });
      if (response.status === 410) {
        // 締切済み → 結果だけ取得
        const result = await fetchPollResult(API_BASE, pollId);
        throw Object.assign(new Error("締切済み"), { closed: true, result });
      }
      if (response.status === 409) throw new Error("already_voted");
      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(error.error ?? "投票に失敗しました");
      }
      const data = await response.json() as { result: PollResult };
      return data.result;
    },
    fetchPollResult: (pollId: string) => fetchPollResult(API_BASE, pollId),
    createPoll: async (payload: {
      title: string; option_a: string; option_b: string; close_in_minutes: number; turnstile_token: string;
    }) => {
      const response = await fetch(`${API_BASE}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sessionHeaders() },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(error.error ?? "投稿に失敗しました");
      }
      return response.json();
    },
  };
}

async function fetchPollResult(apiBase: string, pollId: string): Promise<PollResult> {
  const response = await fetch(`${apiBase}/polls/${pollId}/result`);
  if (!response.ok) throw new Error("結果の取得に失敗しました");
  const data = await response.json() as { result: PollResult };
  return data.result;
}

export { DEFAULT_API_BASE };
