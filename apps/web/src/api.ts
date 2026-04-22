import type { Poll, PollResult, VoteOption } from "./types";

const DEFAULT_API_BASE = "http://127.0.0.1:8787/api/v1";

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_API_BASE;
  if (trimmed.endsWith("/api/v1")) return trimmed;
  return `${trimmed}/api/v1`;
}

export function createApi(baseUrl: string) {
  const API_BASE = normalizeBaseUrl(baseUrl || DEFAULT_API_BASE);

  return {
    initSession: async () => {
      const response = await fetch(`${API_BASE}/sessions/init`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("セッション初期化に失敗しました");
    },
    fetchNextPoll: async (): Promise<Poll | null> => {
      const response = await fetch(`${API_BASE}/polls/next`, { method: "GET", credentials: "include" });
      if (response.status === 204) return null;
      if (!response.ok) throw new Error("投票の取得に失敗しました");
      const data = await response.json();
      return data.poll as Poll;
    },
    votePoll: async (pollId: string, selected: VoteOption): Promise<PollResult> => {
      const response = await fetch(`${API_BASE}/polls/${pollId}/vote`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_option: selected }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error ?? "投票に失敗しました");
      }
      const data = await response.json();
      return data.result as PollResult;
    },
    createPoll: async (payload: {
      title: string; option_a: string; option_b: string; close_in_minutes: number; turnstile_token: string;
    }) => {
      const response = await fetch(`${API_BASE}/polls`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error ?? "投稿に失敗しました");
      }
      return response.json();
    },
  };
}

export { DEFAULT_API_BASE };
