import type { Match, Prediction } from "./types";

export function matchOutcome(home: number, away: number) {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

export function scorePrediction(match: Match, prediction?: Prediction) {
  if (
    !prediction ||
    match.status !== "finished" ||
    match.home_score === null ||
    match.away_score === null
  ) {
    return { points: 0, exactHit: false, resultHit: false, goalHits: 0 };
  }

  const exactHit =
    prediction.home_score === match.home_score && prediction.away_score === match.away_score;
  const resultHit =
    matchOutcome(prediction.home_score, prediction.away_score) ===
    matchOutcome(match.home_score, match.away_score);
  const goalHits =
    Number(prediction.home_score === match.home_score) +
    Number(prediction.away_score === match.away_score);

  if (exactHit) return { points: 5, exactHit, resultHit, goalHits };

  return {
    points: (resultHit ? 3 : 0) + goalHits,
    exactHit,
    resultHit,
    goalHits,
  };
}
