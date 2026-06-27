import type { Match, Prediction } from "./types";

export const SCORING_RULES = [
  { label: "Marcador exacto", points: 5, description: "acertar los goles de ambos equipos." },
  { label: "Resultado correcto", points: 3, description: "acertar ganador o empate sin marcador exacto." },
  { label: "Gol acertado", points: 1, description: "por cada equipo cuyo gol pronosticado coincida." },
] as const;

export function matchOutcome(home: number, away: number) {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

export function scorePrediction(match: Match, prediction?: Prediction) {
  if (
    !prediction ||
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

export function describePredictionScore(match: Match, prediction?: Prediction) {
  const score = scorePrediction(match, prediction);

  if (match.home_score === null || match.away_score === null) {
    return { ...score, details: ["Pendiente de marcador."] };
  }

  if (!prediction) {
    return { ...score, details: ["Sin pronóstico guardado para este partido."] };
  }

  const details = [
    score.exactHit ? "Marcador exacto: +5 pts." : null,
    !score.exactHit && score.resultHit ? "Resultado correcto: +3 pts." : null,
    !score.exactHit && score.goalHits > 0
      ? `Goles acertados: +${score.goalHits} ${score.goalHits === 1 ? "pto" : "pts"}.`
      : null,
    score.points === 0 ? "No acertó marcador, resultado ni goles individuales." : null,
  ].filter((detail): detail is string => Boolean(detail));

  return { ...score, details };
}
