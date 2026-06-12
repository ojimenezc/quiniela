export type Participant = {
  id: string;
  name: string;
  pin: string;
  is_admin: boolean;
  created_at: string;
};

export type Match = {
  id: string;
  match_number: number | null;
  stage: string;
  group_name: string | null;
  home_team: string;
  away_team: string;
  starts_at: string;
  venue: string | null;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "finished";
};

export type Prediction = {
  id: string;
  participant_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  created_at: string;
  updated_at: string;
};

export type LeaderboardRow = {
  participant: Participant;
  points: number;
  exactHits: number;
  resultHits: number;
  resultOnlyHits: number;
  goalHits: number;
  goalBonusHits: number;
  scoredPredictions: number;
  predictions: number;
};
