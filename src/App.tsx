import { FormEvent, useEffect, useMemo, useState } from "react";
import { Trophy, Save, ShieldCheck, LogOut, BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "./supabase";
import { scorePrediction } from "./scoring";
import type { LeaderboardRow, Match, Participant, Prediction } from "./types";
import type { ReactNode } from "react";

const SESSION_KEY = "quiniela.participant";
const GROUP_STAGE_NAMES = new Set(Array.from({ length: 17 }, (_, index) => `Jornada ${index + 1}`));
const PHASE_TABS = [
  { id: "groups", label: "Fase de grupos" },
  { id: "round32", label: "Dieciseisavos" },
  { id: "round16", label: "Octavos" },
  { id: "quarters", label: "Cuartos" },
  { id: "semis", label: "Semis" },
  { id: "finals", label: "Finales" },
] as const;

type PhaseTab = (typeof PHASE_TABS)[number]["id"];

function isAdminParticipant(participant: Participant | null | undefined) {
  return Boolean(participant?.is_admin || participant?.name.trim().toLowerCase() === "admin");
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
    if (!participant) return;

    const match = matches.find((item) => item.id === matchId);
    if (!match || new Date(match.starts_at).getTime() <= Date.now()) {
      setMessage("Este partido ya inició. No se puede modificar el pronóstico.");
      return;
    }

    const { error } = await supabase.from("predictions").upsert(
      {
        participant_id: participant.id,
        match_id: matchId,
        home_score: homeScore,
        away_score: awayScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "participant_id,match_id" },
    );

    setMessage(error ? "No se pudo guardar el pronóstico." : "Pronóstico guardado.");
    await loadData();
  }

  async function saveResult(matchId: string, homeScore: number, awayScore: number) {
    const { error } = await supabase
      .from("matches")
      .update({ home_score: homeScore, away_score: awayScore, status: "finished" })
      .eq("id", matchId);

    setMessage(error ? "No se pudo guardar el resultado." : "Resultado actualizado.");
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

      {message && <div className="notice">{message}</div>}

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
                    <ResultRow key={match.id} match={match} onSave={saveResult} />
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
  prediction,
  onSave,
}: {
  match: Match;
  prediction?: Prediction;
  onSave: (matchId: string, homeScore: number, awayScore: number) => void;
}) {
  const [homeScore, setHomeScore] = useState(prediction?.home_score ?? 0);
  const [awayScore, setAwayScore] = useState(prediction?.away_score ?? 0);
  const locked = new Date(match.starts_at).getTime() <= Date.now();
  const score = scorePrediction(match, prediction);

  return (
    <article className={locked ? "match-row locked" : "match-row"}>
      <div className="match-info">
        <span>
          {match.match_number ? `Partido ${match.match_number} · ` : ""}
          {match.group_name ? `Grupo ${match.group_name}` : match.stage}
        </span>
        <strong>{match.home_team} vs {match.away_team}</strong>
        <small>
          {new Date(match.starts_at).toLocaleString("es-CR")}
          {match.venue ? ` · ${match.venue}` : ""}
          {locked ? " · Cerrado" : ""}
        </small>
      </div>
      <div className="score-editor">
        <input
          type="number"
          min="0"
          value={homeScore}
          disabled={locked}
          onChange={(event) => setHomeScore(Number(event.target.value))}
          aria-label={`Goles de ${match.home_team}`}
        />
        <span>-</span>
        <input
          type="number"
          min="0"
          value={awayScore}
          disabled={locked}
          onChange={(event) => setAwayScore(Number(event.target.value))}
          aria-label={`Goles de ${match.away_team}`}
        />
        <button
          className="icon-button"
          disabled={locked}
          onClick={() => onSave(match.id, homeScore, awayScore)}
          aria-label="Guardar pronóstico"
          title="Guardar pronóstico"
        >
          <Save size={18} />
        </button>
      </div>
      {match.status === "finished" && <span className="points">{score.points} pts</span>}
    </article>
  );
}

function ResultRow({ match, onSave }: { match: Match; onSave: (matchId: string, homeScore: number, awayScore: number) => void }) {
  const [homeScore, setHomeScore] = useState(match.home_score ?? 0);
  const [awayScore, setAwayScore] = useState(match.away_score ?? 0);
  const isFinished = match.status === "finished";

  useEffect(() => {
    setHomeScore(match.home_score ?? 0);
    setAwayScore(match.away_score ?? 0);
  }, [match.away_score, match.home_score]);

  return (
    <article className={isFinished ? "match-row result-row finished" : "match-row result-row"}>
      <div className="match-info">
        <span>
          {match.match_number ? `Partido ${match.match_number} · ` : ""}
          {match.group_name ? `Grupo ${match.group_name}` : match.stage}
        </span>
        <strong>{match.home_team} vs {match.away_team}</strong>
        <small>
          {new Date(match.starts_at).toLocaleString("es-CR")}
          {match.venue ? ` · ${match.venue}` : ""}
        </small>
      </div>
      <div className="result-status">
        <span>{isFinished ? "Finalizado" : "Pendiente"}</span>
        {isFinished && (
          <strong>
            {match.home_score} - {match.away_score}
          </strong>
        )}
      </div>
      <div className="score-editor">
        <input
          type="number"
          min="0"
          value={homeScore}
          onChange={(event) => setHomeScore(Number(event.target.value))}
          aria-label={`Resultado real de ${match.home_team}`}
        />
        <span>-</span>
        <input
          type="number"
          min="0"
          value={awayScore}
          onChange={(event) => setAwayScore(Number(event.target.value))}
          aria-label={`Resultado real de ${match.away_team}`}
        />
        <button
          className="icon-button"
          onClick={() => onSave(match.id, homeScore, awayScore)}
          aria-label="Guardar resultado real"
          title="Guardar resultado real"
        >
          <Save size={18} />
        </button>
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
