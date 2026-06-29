import type { Match, Prediction } from "./types";

export const SCORING_RULES = [
  { label: "Marcador exacto", points: 5, description: "acertar los goles de ambos equipos." },
  { label: "Resultado correcto", points: 3, description: "acertar ganador o empate sin marcador exacto." },
  { label: "Gol acertado", points: 1, description: "por cada equipo cuyo gol pronosticado coincida." },
  { label: "Ganador por penales", points: 2, description: "si el partido se define en penales." },
] as const;

export function matchOutcome(home: number, away: number) {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

function hasPenaltyScore(
  match: Match,
): match is Match & { home_penalty_score: number; away_penalty_score: number } {
  return match.home_penalty_score != null && match.away_penalty_score != null;
}

function penaltyOutcome(home: number, away: number) {
  if (home > away) return "home";
  if (away > home) return "away";
  return null;
}

function predictionWinner(prediction: Prediction) {
  const predictedMatchOutcome = matchOutcome(prediction.home_score, prediction.away_score);
  return predictedMatchOutcome === "draw" ? null : predictedMatchOutcome;
}

export function scorePrediction(match: Match, prediction?: Prediction) {
  if (
    !prediction ||
    match.home_score === null ||
    match.away_score === null
  ) {
    return { points: 0, exactHit: false, resultHit: false, goalHits: 0, penaltyWinnerHit: false };
  }

  if (hasPenaltyScore(match)) {
    const officialHomePenaltyScore = match.home_penalty_score;
    const officialAwayPenaltyScore = match.away_penalty_score;
    const officialPenaltyOutcome = penaltyOutcome(officialHomePenaltyScore, officialAwayPenaltyScore);
    const predictedPenaltyOutcome = predictionWinner(prediction);
    const penaltyWinnerHit =
      officialPenaltyOutcome !== null && predictedPenaltyOutcome === officialPenaltyOutcome;

    return {
      points: penaltyWinnerHit ? 2 : 0,
      exactHit: false,
      resultHit: false,
      goalHits: 0,
      penaltyWinnerHit,
    };
  }

  const exactHit =
    prediction.home_score === match.home_score && prediction.away_score === match.away_score;
  const resultHit =
    matchOutcome(prediction.home_score, prediction.away_score) ===
    matchOutcome(match.home_score, match.away_score);
  const goalHits =
    Number(prediction.home_score === match.home_score) +
    Number(prediction.away_score === match.away_score);

  if (exactHit) return { points: 5, exactHit, resultHit, goalHits, penaltyWinnerHit: false };

  return {
    points: (resultHit ? 3 : 0) + goalHits,
    exactHit,
    resultHit,
    goalHits,
    penaltyWinnerHit: false,
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

  if (hasPenaltyScore(match)) {
    return {
      ...score,
      details: [
        score.penaltyWinnerHit
          ? "Ganador por penales acertado: +2 pts. Solo se puntuó por penales."
          : "El partido fue a penales; solo cuenta el ganador por penales.",
      ],
    };
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
