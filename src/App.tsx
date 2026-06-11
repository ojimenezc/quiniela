import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Trophy,
  Save,
  ShieldCheck,
  LogOut,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "./supabase";
import { scorePrediction } from "./scoring";
import type { LeaderboardRow, Match, Participant, Prediction } from "./types";
import type { ReactNode } from "react";

const SESSION_KEY = "quiniela.participant";
const MAX_SCORE = 15;
const GROUP_STAGE_NAMES = new Set(Array.from({ length: 17 }, (_, index) => `Jornada ${index + 1}`));
const PHASE_TABS = [
  { id: "groups", label: "Fase de grupos" },
  { id: "round32", label: "Dieciseisavos" },
  { id: "round16", label: "Octavos" },
  { id: "quarters", label: "Cuartos" },
  { id: "semis", label: "Semis" },
  { id: "finals", label: "Finales" },
] as const;
const TEAM_FLAGS: Record<string, string> = {
  Alemania: "🇩🇪",
  "Arabia Saudita": "🇸🇦",
  Argelia: "🇩🇿",
  Argentina: "🇦🇷",
  Australia: "🇦🇺",
  Austria: "🇦🇹",
  Bélgica: "🇧🇪",
  "Bosnia y Herzegovina": "🇧🇦",
  Brasil: "🇧🇷",
  "Cabo Verde": "🇨🇻",
  Canadá: "🇨🇦",
  Catar: "🇶🇦",
  Colombia: "🇨🇴",
  "Corea del Sur": "🇰🇷",
  "Costa de Marfil": "🇨🇮",
  Croacia: "🇭🇷",
  Curazao: "🇨🇼",
  Ecuador: "🇪🇨",
  Egipto: "🇪🇬",
  Escocia: "🏴",
  España: "🇪🇸",
  "Estados Unidos": "🇺🇸",
  Francia: "🇫🇷",
  Ghana: "🇬🇭",
  Haití: "🇭🇹",
  Inglaterra: "🏴",
  Irak: "🇮🇶",
  Irán: "🇮🇷",
  Japón: "🇯🇵",
  Jordania: "🇯🇴",
  Marruecos: "🇲🇦",
  México: "🇲🇽",
  Noruega: "🇳🇴",
  "Nueva Zelanda": "🇳🇿",
  Panamá: "🇵🇦",
  Paraguay: "🇵🇾",
  "Países Bajos": "🇳🇱",
  Portugal: "🇵🇹",
  "RD Congo": "🇨🇩",
  "República Checa": "🇨🇿",
  Senegal: "🇸🇳",
  Sudáfrica: "🇿🇦",
  Suecia: "🇸🇪",
  Suiza: "🇨🇭",
  Túnez: "🇹🇳",
  Turquía: "🇹🇷",
  Uruguay: "🇺🇾",
  Uzbekistán: "🇺🇿",
};

type PhaseTab = (typeof PHASE_TABS)[number]["id"];
type MainTab = "predictions" | "standings";
type ScoreInput = number | "";
type GroupStandingRow = {
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

function isAdminParticipant(participant: Participant | null | undefined) {
  return Boolean(participant?.is_admin || participant?.name.trim().toLowerCase() === "admin");
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), MAX_SCORE);
}

function readScoreInput(value: string): ScoreInput {
  return value === "" ? "" : clampScore(Number(value));
}

function isMatchLocked(match: Match, now = Date.now()) {
  const startsAt = new Date(match.starts_at).getTime();
  return match.status === "finished" || (Number.isFinite(startsAt) && startsAt <= now);
}

function TeamName({ name }: { name: string }) {
  const flag = TEAM_FLAGS[name];

  return (
    <span className="team-name">
      {flag && (
        <span className="team-flag" aria-hidden="true">
          {flag}
        </span>
      )}
      <span>{name}</span>
    </span>
  );
}

export function App() {
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activePhase, setActivePhase] = useState<PhaseTab>("groups");
  const [activeGroupTitle, setActiveGroupTitle] = useState<string>("");
  const [activeAdminPhase, setActiveAdminPhase] = useState<PhaseTab>("groups");
  const [activeAdminGroupTitle, setActiveAdminGroupTitle] = useState<string>("");
  const [activeMainTab, setActiveMainTab] = useState<MainTab>("predictions");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const savedParticipant = JSON.parse(raw) as Participant | null;
        if (savedParticipant?.id) setParticipant(savedParticipant);
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    void loadData();
  }, []);

  useEffect(() => {
    if (!message || !participant) return;

    const timeoutId = window.setTimeout(() => {
      setMessage("");
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [message, participant]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  async function loadData() {
    setLoading(true);
    const [participantsResult, matchesResult, predictionsResult] = await Promise.all([
      supabase.from("participants").select("*").order("created_at"),
      supabase.from("matches").select("*").order("starts_at"),
      supabase.from("predictions").select("*"),
    ]);

    if (participantsResult.error || matchesResult.error || predictionsResult.error) {
      setMessage("No se pudieron cargar los datos de la quiniela.");
    } else {
      setParticipants(participantsResult.data ?? []);
      setMatches(matchesResult.data ?? []);
      setPredictions(predictionsResult.data ?? []);
    }
    setLoading(false);
  }

  async function handleLogin(name: string, pin: string) {
    const cleanName = name.trim();
    const cleanPin = pin.trim();
    if (!cleanName || !cleanPin) return;

    const existing = participants.find(
      (item) => item.name.toLowerCase() === cleanName.toLowerCase() && item.pin === cleanPin,
    );

    if (existing) {
      setParticipant(existing);
      localStorage.setItem(SESSION_KEY, JSON.stringify(existing));
      return;
    }

    const nameTaken = participants.some((item) => item.name.toLowerCase() === cleanName.toLowerCase());
    if (nameTaken) {
      setMessage("Ese nombre ya existe. Revisa el PIN o usa otro alias.");
      return;
    }

    const { data, error } = await supabase
      .from("participants")
      .insert({ name: cleanName, pin: cleanPin, is_admin: false })
      .select()
      .single();

    if (error) {
      setMessage("No se pudo crear el participante.");
      return;
    }

    setParticipant(data);
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    await loadData();
  }

  async function savePrediction(matchId: string, homeScore: number, awayScore: number) {
    if (!participant) return false;

    const match = matches.find((item) => item.id === matchId);
    if (!match || isMatchLocked(match)) {
      setMessage("Este partido está cerrado. No se puede modificar el pronóstico.");
      return false;
    }

    const nextHomeScore = clampScore(homeScore);
    const nextAwayScore = clampScore(awayScore);
    const { data, error } = await supabase.from("predictions").upsert(
      {
        participant_id: participant.id,
        match_id: matchId,
        home_score: nextHomeScore,
        away_score: nextAwayScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "participant_id,match_id" },
    ).select().single();

    if (error || !data) {
      setMessage("No se pudo guardar el pronóstico.");
      return false;
    }

    setPredictions((currentPredictions) => {
      const exists = currentPredictions.some((item) => item.id === data.id);
      if (exists) {
        return currentPredictions.map((item) => (item.id === data.id ? data : item));
      }
      return [...currentPredictions, data];
    });
    setMessage("Pronóstico guardado.");
    return true;
  }

  async function saveResult(matchId: string, homeScore: number, awayScore: number) {
    const { error } = await supabase
      .from("matches")
      .update({ home_score: clampScore(homeScore), away_score: clampScore(awayScore) })
      .eq("id", matchId);

    setMessage(error ? "No se pudo guardar el marcador." : "Marcador actualizado.");
    await loadData();
  }

  async function saveTeams(matchId: string, homeTeam: string, awayTeam: string) {
    const cleanHomeTeam = homeTeam.trim();
    const cleanAwayTeam = awayTeam.trim();
    if (!cleanHomeTeam || !cleanAwayTeam) {
      setMessage("Debes ingresar ambos equipos.");
      return;
    }

    const { error } = await supabase
      .from("matches")
      .update({ home_team: cleanHomeTeam, away_team: cleanAwayTeam })
      .eq("id", matchId);

    setMessage(error ? "No se pudieron guardar los equipos." : "Equipos actualizados.");
    await loadData();
  }

  async function finishMatch(matchId: string) {
    const { error } = await supabase.from("matches").update({ status: "finished" }).eq("id", matchId);

    setMessage(error ? "No se pudo cerrar el partido." : "Partido marcado como finalizado.");
    await loadData();
  }

  async function clearResult(matchId: string) {
    const { error } = await supabase
      .from("matches")
      .update({ home_score: null, away_score: null, status: "scheduled" })
      .eq("id", matchId);

    setMessage(error ? "No se pudo quitar el resultado." : "Resultado quitado.");
    await loadData();
  }

  const leaderboard = useMemo(() => {
    const rankingParticipants =
      participant && !participants.some((item) => item.id === participant.id)
        ? [...participants, participant]
        : participants;

    const rows = rankingParticipants.filter((item) => !isAdminParticipant(item)).map<LeaderboardRow>((item) => {
      let points = 0;
      let exactHits = 0;
      let resultHits = 0;
      let goalHits = 0;
      let predictionCount = 0;

      for (const match of matches) {
        const prediction = predictions.find(
          (candidate) => candidate.participant_id === item.id && candidate.match_id === match.id,
        );
        if (prediction) predictionCount += 1;
        const score = scorePrediction(match, prediction);
        points += score.points;
        exactHits += Number(score.exactHit);
        resultHits += Number(score.resultHit);
        goalHits += score.goalHits;
      }

      return { participant: item, points, exactHits, resultHits, goalHits, predictions: predictionCount };
    });

    return rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
      return b.resultHits - a.resultHits;
    });
  }, [matches, participant, participants, predictions]);

  const groupedMatches = useMemo(() => groupMatchesByStage(matches), [matches]);
  const groupStandings = useMemo(() => buildGroupStandings(matches), [matches]);
  const officialResultsCount = useMemo(
    () =>
      matches.filter(
        (match) => match.status === "finished" && match.home_score !== null && match.away_score !== null,
      ).length,
    [matches],
  );
  const visibleGroups = useMemo(
    () => groupedMatches.filter((group) => getPhaseTab(group.title) === activePhase),
    [activePhase, groupedMatches],
  );
  const selectedGroupTitle = activeGroupTitle || visibleGroups[0]?.title || "";
  const selectedGroup = visibleGroups.find((group) => group.title === selectedGroupTitle) ?? visibleGroups[0];
  const isAdmin = isAdminParticipant(participant);
  const adminVisibleGroups = useMemo(
    () => groupedMatches.filter((group) => getPhaseTab(group.title) === activeAdminPhase),
    [activeAdminPhase, groupedMatches],
  );
  const selectedAdminGroupTitle = activeAdminGroupTitle || adminVisibleGroups[0]?.title || "";
  const selectedAdminGroup =
    adminVisibleGroups.find((group) => group.title === selectedAdminGroupTitle) ?? adminVisibleGroups[0];
  const currentParticipantRank =
    !participant
      ? "-"
      : isAdmin
        ? "Admin"
        : officialResultsCount === 0
          ? "Sin resultados"
        : `#${leaderboard.findIndex((row) => row.participant.id === participant.id) + 1}`;

  useEffect(() => {
    const firstVisibleGroup = visibleGroups[0]?.title ?? "";
    if (firstVisibleGroup && !visibleGroups.some((group) => group.title === activeGroupTitle)) {
      setActiveGroupTitle(firstVisibleGroup);
    }
  }, [activeGroupTitle, visibleGroups]);

  useEffect(() => {
    const firstVisibleGroup = adminVisibleGroups[0]?.title ?? "";
    if (firstVisibleGroup && !adminVisibleGroups.some((group) => group.title === activeAdminGroupTitle)) {
      setActiveAdminGroupTitle(firstVisibleGroup);
    }
  }, [activeAdminGroupTitle, adminVisibleGroups]);

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setParticipant(null);
  }

  if (!participant) {
    return <LoginScreen loading={loading} message={message} onLogin={handleLogin} />;
  }

  return (
    <main className="app-shell">
      <div className="field-glow" aria-hidden="true" />
      <div className="ball-run" aria-hidden="true" />
      <header className="topbar">
        <div>
          <p className="eyebrow">Quiniela Mundial</p>
          <h1>Hola, {participant.name}</h1>
        </div>
        <button className="icon-button" onClick={logout} aria-label="Salir" title="Salir">
          <LogOut size={20} />
        </button>
      </header>

      {message && (
        <div className="toast" role="status" aria-live="polite">
          {message}
        </div>
      )}

      <section className="summary-grid">
        <Metric label="Tu posición" value={currentParticipantRank} />
        <Metric
          label="Tus puntos"
          value={String(leaderboard.find((row) => row.participant.id === participant.id)?.points ?? 0)}
        />
        <Metric label="Resultados oficiales" value={`${officialResultsCount}/${matches.length}`} />
      </section>

      <div className="layout">
        <section className="panel">
          <div className="main-tabs" role="tablist" aria-label="Vista principal">
            <button
              type="button"
              className={activeMainTab === "predictions" ? "active" : ""}
              onClick={() => setActiveMainTab("predictions")}
            >
              <Trophy size={18} />
              Pronósticos
            </button>
            <button
              type="button"
              className={activeMainTab === "standings" ? "active" : ""}
              onClick={() => setActiveMainTab("standings")}
            >
              <BarChart3 size={18} />
              Grupos
            </button>
          </div>
          {activeMainTab === "predictions" ? (
            <section>
              <div className="section-heading">
                <Trophy size={20} />
                <h2>Mis pronósticos</h2>
              </div>
              {loading ? (
                <p>Cargando...</p>
              ) : (
                <>
                  <PhaseTabs activePhase={activePhase} onChange={setActivePhase} groups={groupedMatches} />
                  {visibleGroups.length > 1 && (
                    <GroupCarousel
                      groups={visibleGroups}
                      activeTitle={selectedGroupTitle}
                      onChange={setActiveGroupTitle}
                    />
                  )}
                  {selectedGroup && (
                    <MatchGroup title={selectedGroup.title} matches={selectedGroup.matches}>
                      {selectedGroup.matches.map((match) => (
                        <PredictionRow
                          key={match.id}
                          match={match}
                          now={now}
                          prediction={predictions.find(
                            (item) => item.participant_id === participant.id && item.match_id === match.id,
                          )}
                          onSave={savePrediction}
                        />
                      ))}
                    </MatchGroup>
                  )}
                </>
              )}
            </section>
          ) : (
            <section>
              <div className="section-heading">
                <BarChart3 size={20} />
                <h2>Grupos y posiciones</h2>
              </div>
              {loading ? <p>Cargando...</p> : <GroupStandings groups={groupStandings} />}
            </section>
          )}
        </section>

        <section className="panel">
          <div className="section-heading">
            <BarChart3 size={20} />
            <h2>Ranking</h2>
          </div>
          <Leaderboard rows={leaderboard} />
        </section>
      </div>

      {isAdmin && (
        <section className="panel admin-panel">
          <div className="section-heading admin-heading">
            <div>
              <ShieldCheck size={20} />
              <h2>Resultados reales</h2>
            </div>
            <span>Visible solo para admin</span>
          </div>
          {loading ? (
            <p>Cargando...</p>
          ) : (
            <>
              <PhaseTabs activePhase={activeAdminPhase} onChange={setActiveAdminPhase} groups={groupedMatches} />
              {adminVisibleGroups.length > 1 && (
                <GroupCarousel
                  groups={adminVisibleGroups}
                  activeTitle={selectedAdminGroupTitle}
                  onChange={setActiveAdminGroupTitle}
                />
              )}
              {selectedAdminGroup && (
                <MatchGroup title={selectedAdminGroup.title} matches={selectedAdminGroup.matches}>
                  {selectedAdminGroup.matches.map((match) => (
                    <ResultRow
                      key={match.id}
                      match={match}
                      onSaveTeams={saveTeams}
                      onSave={saveResult}
                      onFinish={finishMatch}
                      onClear={clearResult}
                    />
                  ))}
                </MatchGroup>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}

function buildGroupStandings(matches: Match[]) {
  const groups = new Map<string, Map<string, GroupStandingRow>>();

  function getRow(groupName: string, team: string) {
    const groupRows = groups.get(groupName) ?? new Map<string, GroupStandingRow>();
    groups.set(groupName, groupRows);

    const existing = groupRows.get(team);
    if (existing) return existing;

    const row: GroupStandingRow = {
      team,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    };
    groupRows.set(team, row);
    return row;
  }

  for (const match of matches) {
    if (!match.group_name) continue;

    const home = getRow(match.group_name, match.home_team);
    const away = getRow(match.group_name, match.away_team);

    if (match.status !== "finished" || match.home_score === null || match.away_score === null) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += match.home_score;
    home.goalsAgainst += match.away_score;
    away.goalsFor += match.away_score;
    away.goalsAgainst += match.home_score;

    if (match.home_score > match.away_score) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (match.home_score < match.away_score) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }

    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;
  }

  return Array.from(groups.entries())
    .map(([groupName, rows]) => ({
      groupName,
      rows: Array.from(rows.values()).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return a.team.localeCompare(b.team, "es");
      }),
    }))
    .sort((a, b) => a.groupName.localeCompare(b.groupName, "es", { numeric: true }));
}

function groupMatchesByStage(matches: Match[]) {
  const groups = new Map<string, Match[]>();

  for (const match of matches) {
    const title = GROUP_STAGE_NAMES.has(match.stage) ? match.stage : match.stage;

    groups.set(title, [...(groups.get(title) ?? []), match]);
  }

  return Array.from(groups.entries())
    .map(([title, groupMatches]) => ({
      title,
      matches: groupMatches.sort(
        (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      ),
    }))
    .sort(
      (a, b) =>
        new Date(a.matches[0].starts_at).getTime() - new Date(b.matches[0].starts_at).getTime(),
    );
}

function getPhaseTab(stage: string): PhaseTab {
  if (GROUP_STAGE_NAMES.has(stage)) return "groups";
  if (stage === "Dieciseisavos de final") return "round32";
  if (stage === "Octavos de final") return "round16";
  if (stage === "Cuartos de final") return "quarters";
  if (stage === "Semifinal") return "semis";
  return "finals";
}

function PhaseTabs({
  activePhase,
  onChange,
  groups,
}: {
  activePhase: PhaseTab;
  onChange: (phase: PhaseTab) => void;
  groups: Array<{ title: string; matches: Match[] }>;
}) {
  const groupsByPhase = new Map<PhaseTab, Array<{ title: string; matches: Match[] }>>();
  for (const group of groups) {
    const phase = getPhaseTab(group.title);
    groupsByPhase.set(phase, [...(groupsByPhase.get(phase) ?? []), group]);
  }

  return (
    <div className="phase-tabs" role="tablist" aria-label="Secciones">
      {PHASE_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === activePhase ? "active" : ""}
          disabled={!groupsByPhase.has(tab.id)}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function GroupCarousel({
  groups,
  activeTitle,
  onChange,
}: {
  groups: Array<{ title: string; matches: Match[] }>;
  activeTitle: string;
  onChange: (title: string) => void;
}) {
  const activeIndex = Math.max(0, groups.findIndex((group) => group.title === activeTitle));
  const activeGroup = groups[activeIndex] ?? groups[0];

  function goTo(index: number) {
    const nextGroup = groups[Math.min(Math.max(index, 0), groups.length - 1)];
    if (nextGroup) onChange(nextGroup.title);
  }

  return (
    <section className="group-carousel" aria-label="Jornadas">
      <button
        type="button"
        className="icon-button secondary"
        disabled={activeIndex === 0}
        onClick={() => goTo(activeIndex - 1)}
        aria-label="Jornada anterior"
        title="Jornada anterior"
      >
        <ChevronLeft size={18} />
      </button>
      <div className="carousel-current">
        <strong>{activeGroup.title}</strong>
        <span>
          {activeIndex + 1} de {groups.length}
        </span>
      </div>
      <button
        type="button"
        className="icon-button secondary"
        disabled={activeIndex === groups.length - 1}
        onClick={() => goTo(activeIndex + 1)}
        aria-label="Jornada siguiente"
        title="Jornada siguiente"
      >
        <ChevronRight size={18} />
      </button>
    </section>
  );
}

function MatchGroup({
  title,
  matches,
  children,
}: {
  title: string;
  matches: Match[];
  children: ReactNode;
}) {
  const completed = matches.filter((match) => match.status === "finished").length;
  const firstDate = new Date(matches[0].starts_at).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "long",
  });
  const lastDate = new Date(matches[matches.length - 1].starts_at).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "long",
  });
  const dateRange = firstDate === lastDate ? firstDate : `${firstDate} - ${lastDate}`;

  return (
    <section className="match-group">
      <header className="match-group-header">
        <div>
          <h3>{title}</h3>
          <span>{dateRange}</span>
        </div>
        <strong>
          {completed}/{matches.length}
        </strong>
      </header>
      <div className="match-list">{children}</div>
    </section>
  );
}

function LoginScreen({
  loading,
  message,
  onLogin,
}: {
  loading: boolean;
  message: string;
  onLogin: (name: string, pin: string) => void;
}) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    onLogin(name, pin);
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <p className="eyebrow">Quiniela Mundial</p>
        <h1>Pronósticos del equipo</h1>
        <form onSubmit={submit}>
          <label>
            Alias
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" />
          </label>
          <label>
            PIN
            <input value={pin} onChange={(event) => setPin(event.target.value)} placeholder="Cualquier PIN que recuerdes" />
          </label>
          <button type="submit" disabled={loading}>
            Entrar
          </button>
        </form>
        {message && <div className="notice">{message}</div>}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PredictionRow({
  match,
  now,
  prediction,
  onSave,
}: {
  match: Match;
  now: number;
  prediction?: Prediction;
  onSave: (matchId: string, homeScore: number, awayScore: number) => Promise<boolean>;
}) {
  const [homeScore, setHomeScore] = useState<ScoreInput>(prediction?.home_score ?? "");
  const [awayScore, setAwayScore] = useState<ScoreInput>(prediction?.away_score ?? "");
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ homeScore: number; awayScore: number } | null>(null);
  const savedHomeScore = prediction?.home_score;
  const savedAwayScore = prediction?.away_score;
  const effectiveSavedHomeScore = pendingSave?.homeScore ?? savedHomeScore;
  const effectiveSavedAwayScore = pendingSave?.awayScore ?? savedAwayScore;
  const locked = isMatchLocked(match, now);
  const score = scorePrediction(match, prediction);
  const canSave = homeScore !== "" && awayScore !== "";
  const scoreDetails =
    match.status === "finished" && prediction
      ? [
          score.exactHit ? "5 por marcador exacto" : null,
          !score.exactHit && score.resultHit ? "3 por resultado correcto" : null,
          !score.exactHit && score.goalHits > 0
            ? `${score.goalHits} por ${score.goalHits === 1 ? "gol acertado" : "goles acertados"}`
            : null,
          score.points === 0 ? "Sin aciertos" : null,
        ].filter(Boolean)
      : [];

  useEffect(() => {
    if (!hasUserEdited && !pendingSave) {
      setHomeScore(prediction?.home_score ?? "");
      setAwayScore(prediction?.away_score ?? "");
    }
  }, [hasUserEdited, pendingSave, prediction?.away_score, prediction?.home_score]);

  useEffect(() => {
    if (
      pendingSave &&
      prediction?.home_score === pendingSave.homeScore &&
      prediction?.away_score === pendingSave.awayScore
    ) {
      setPendingSave(null);
    }
  }, [pendingSave, prediction?.away_score, prediction?.home_score]);

  useEffect(() => {
    if (!hasUserEdited || locked || !canSave) return;
    if (homeScore === effectiveSavedHomeScore && awayScore === effectiveSavedAwayScore) return;

    const timeoutId = window.setTimeout(() => {
      saveScores(homeScore, awayScore);
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [
    awayScore,
    canSave,
    effectiveSavedAwayScore,
    effectiveSavedHomeScore,
    hasUserEdited,
    homeScore,
    locked,
    match.id,
  ]);

  function saveScores(nextHomeScore: number, nextAwayScore: number) {
    if (locked) {
      setHasUserEdited(false);
      return;
    }

    if (nextHomeScore === effectiveSavedHomeScore && nextAwayScore === effectiveSavedAwayScore) {
      setHasUserEdited(false);
      return;
    }

    setPendingSave({ homeScore: nextHomeScore, awayScore: nextAwayScore });
    setHasUserEdited(false);
    void onSave(match.id, nextHomeScore, nextAwayScore).then((saved) => {
      if (!saved) setPendingSave(null);
    });
  }

  function saveNow() {
    if (homeScore === "" || awayScore === "") return;
    saveScores(homeScore, awayScore);
  }

  return (
    <article className={locked ? "match-row locked" : "match-row"}>
      <div className="match-info">
        <span>
          {match.match_number ? `Partido ${match.match_number} · ` : ""}
          {match.group_name ? `Grupo ${match.group_name}` : match.stage}
        </span>
        <strong className="match-teams">
          <TeamName name={match.home_team} />
          <span>vs</span>
          <TeamName name={match.away_team} />
        </strong>
        <small>
          {new Date(match.starts_at).toLocaleString("es-CR")}
          {match.venue ? ` · ${match.venue}` : ""}
          {locked ? " · Cerrado" : ""}
        </small>
        {match.status === "finished" && match.home_score !== null && match.away_score !== null && (
          <div className="official-score">
            <span>Final</span>
            <strong>
              {match.home_score} - {match.away_score}
            </strong>
          </div>
        )}
      </div>
      <div className="score-editor">
        <input
          type="number"
          min="0"
          max={MAX_SCORE}
          value={homeScore}
          disabled={locked}
          placeholder="Local"
          onChange={(event) => {
            setHasUserEdited(true);
            setHomeScore(readScoreInput(event.target.value));
          }}
          onBlur={saveNow}
          aria-label={`Goles de ${match.home_team}`}
        />
        <span>-</span>
        <input
          type="number"
          min="0"
          max={MAX_SCORE}
          value={awayScore}
          disabled={locked}
          placeholder="Visita"
          onChange={(event) => {
            setHasUserEdited(true);
            setAwayScore(readScoreInput(event.target.value));
          }}
          onBlur={saveNow}
          aria-label={`Goles de ${match.away_team}`}
        />
      </div>
      {match.status === "finished" && (
        <div className="points-breakdown">
          <span className="points">{score.points} pts</span>
          {scoreDetails.length > 0 && <small>{scoreDetails.join(" · ")}</small>}
        </div>
      )}
    </article>
  );
}

function ResultRow({
  match,
  onSaveTeams,
  onSave,
  onFinish,
  onClear,
}: {
  match: Match;
  onSaveTeams: (matchId: string, homeTeam: string, awayTeam: string) => void;
  onSave: (matchId: string, homeScore: number, awayScore: number) => void;
  onFinish: (matchId: string) => void;
  onClear: (matchId: string) => void;
}) {
  const [homeTeam, setHomeTeam] = useState(match.home_team);
  const [awayTeam, setAwayTeam] = useState(match.away_team);
  const [homeScore, setHomeScore] = useState<ScoreInput>(match.home_score ?? "");
  const [awayScore, setAwayScore] = useState<ScoreInput>(match.away_score ?? "");
  const isFinished = match.status === "finished";
  const canEditTeams = !GROUP_STAGE_NAMES.has(match.stage);
  const canSave = homeScore !== "" && awayScore !== "";
  const canSaveTeams = homeTeam.trim() !== "" && awayTeam.trim() !== "";

  useEffect(() => {
    setHomeTeam(match.home_team);
    setAwayTeam(match.away_team);
  }, [match.away_team, match.home_team]);

  useEffect(() => {
    setHomeScore(match.home_score ?? "");
    setAwayScore(match.away_score ?? "");
  }, [match.away_score, match.home_score]);

  return (
    <article className={isFinished ? "match-row result-row finished" : "match-row result-row"}>
      <div className="match-info">
        <span>
          {match.match_number ? `Partido ${match.match_number} · ` : ""}
          {match.group_name ? `Grupo ${match.group_name}` : match.stage}
        </span>
        <strong className="match-teams">
          <TeamName name={match.home_team} />
          <span>vs</span>
          <TeamName name={match.away_team} />
        </strong>
        <small>
          {new Date(match.starts_at).toLocaleString("es-CR")}
          {match.venue ? ` · ${match.venue}` : ""}
        </small>
      </div>
      <div className="admin-match-controls">
        {canEditTeams && (
          <div className="team-editor">
            <input
              value={homeTeam}
              onChange={(event) => setHomeTeam(event.target.value)}
              aria-label="Equipo local"
            />
            <span>vs</span>
            <input
              value={awayTeam}
              onChange={(event) => setAwayTeam(event.target.value)}
              aria-label="Equipo visitante"
            />
            <button
              className="icon-button"
              disabled={!canSaveTeams}
              onClick={() => onSaveTeams(match.id, homeTeam, awayTeam)}
              aria-label="Guardar equipos"
              title="Guardar equipos"
            >
              <Save size={18} />
            </button>
          </div>
        )}
        <div className="score-editor result-editor">
          <input
            type="number"
            min="0"
            max={MAX_SCORE}
            value={homeScore}
            placeholder="Local"
            onChange={(event) => setHomeScore(readScoreInput(event.target.value))}
            aria-label={`Resultado real de ${match.home_team}`}
          />
          <span>-</span>
          <input
            type="number"
            min="0"
            max={MAX_SCORE}
            value={awayScore}
            placeholder="Visita"
            onChange={(event) => setAwayScore(readScoreInput(event.target.value))}
            aria-label={`Resultado real de ${match.away_team}`}
          />
          <button
            className="icon-button"
            disabled={!canSave}
            onClick={() => {
              if (homeScore !== "" && awayScore !== "") onSave(match.id, homeScore, awayScore);
            }}
            aria-label="Guardar resultado real"
            title="Guardar resultado real"
          >
            <Save size={18} />
          </button>
          {!isFinished && (
            <button
              className="icon-button finish"
              disabled={!canSave}
              onClick={() => {
                if (homeScore !== "" && awayScore !== "") onFinish(match.id);
              }}
              aria-label="Marcar partido como finalizado"
              title="Marcar partido como finalizado"
            >
              <CheckCircle2 size={18} />
            </button>
          )}
          {(isFinished || match.home_score !== null || match.away_score !== null) && (
            <button
              className="icon-button danger"
              onClick={() => onClear(match.id)}
              aria-label="Quitar marcador y reabrir"
              title="Quitar marcador y reabrir"
            >
              <RotateCcw size={18} />
            </button>
          )}
        </div>
      </div>
      <div className="result-status">
        <span>{isFinished ? "Finalizado" : "Pendiente"}</span>
        {isFinished && (
          <strong>
            {match.home_score} - {match.away_score}
          </strong>
        )}
      </div>
    </article>
  );
}

function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const visibleRows = rows.filter((row) => !isAdminParticipant(row.participant));

  return (
    <div className="leaderboard">
      {visibleRows.map((row, index) => (
        <div className="leaderboard-row" key={row.participant.id}>
          <strong>#{index + 1}</strong>
          <span>{row.participant.name}</span>
          <b>{row.points} pts</b>
          <small>{row.exactHits} exactos · {row.resultHits} resultados · {row.goalHits} goles</small>
        </div>
      ))}
    </div>
  );
}

function GroupStandings({
  groups,
}: {
  groups: Array<{ groupName: string; rows: GroupStandingRow[] }>;
}) {
  if (groups.length === 0) {
    return <p>No hay grupos disponibles.</p>;
  }

  return (
    <div className="standings-grid">
      {groups.map((group) => (
        <section className="standings-card" key={group.groupName}>
          <header>
            <h3>Grupo {group.groupName}</h3>
          </header>
          <div className="standings-table" role="table" aria-label={`Posiciones del grupo ${group.groupName}`}>
            <div className="standings-row standings-head" role="row">
              <span>Pos</span>
              <span>Equipo</span>
              <span>PJ</span>
              <span>DG</span>
              <span>Pts</span>
            </div>
            {group.rows.map((row, index) => (
              <div className="standings-row" role="row" key={row.team}>
                <span>{index + 1}</span>
                <strong>
                  <TeamName name={row.team} />
                </strong>
                <span>{row.played}</span>
                <span>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</span>
                <b>{row.points}</b>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
