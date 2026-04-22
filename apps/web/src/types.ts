export type VoteOption = "A" | "B";

export interface Poll {
  id: string;
  title: string;
  option_a: string;
  option_b: string;
  closes_at: string;
}

export interface PollResult {
  votes_a: number;
  votes_b: number;
  percent_a: number;
  percent_b: number;
  total_votes: number;
}
