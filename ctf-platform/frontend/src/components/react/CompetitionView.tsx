import { useEffect, useState } from "react";
import {
  fetchCompetitionConfig,
  fetchChallenges,
  fetchMyTeam,
} from "../../lib/api";
import type { CompetitionConfig, Challenge, Team } from "../../lib/schemas";
import ChallengeCard from "./ChallengeCard";
import { IconArrowLeft, IconArrowRight, IconFlag, IconClipboardList } from "./icons";

const ORDER: Record<string, number> = {
  sqli: 1, cmdi: 2, xss: 3, lfi: 4, "path-traversal": 5,
  ssti: 6, idor: 7, "format-string": 8, jwt: 9, xxe: 10,
  "crypto-rsa": 11, "crypto-vigenere": 12,
  "forensics-pcap": 13, stego: 14,
};

const CATEGORY_GROUPS: Record<string, string[]> = {
  "Web":     ["sqli", "cmdi", "xss", "lfi", "path-traversal", "ssti", "idor", "format-string", "jwt", "xxe"],
  "Crypto":  ["crypto-rsa", "crypto-vigenere"],
  "Forense": ["forensics-pcap", "stego"],
};

function getGroup(slug: string): string {
  for (const [group, slugs] of Object.entries(CATEGORY_GROUPS)) {
    if (slugs.includes(slug)) return group;
  }
  return "Otros";
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-BO", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Header de competencia ────────────────────────────────────────────────────

function CompetitionHeader({
  cfg,
  team,
  now,
}: {
  cfg: CompetitionConfig;
  team: Team | null;
  now: Date;
}) {
  const start = cfg.start_time ? new Date(cfg.start_time) : null;
  const end = cfg.end_time ? new Date(cfg.end_time) : null;
  const ended = end && now > end;
  const pending = start && now < start;
  const active = !pending && !ended;
  const msLeft = end ? end.getTime() - now.getTime() : null;
  const msToStart = start ? start.getTime() - now.getTime() : null;
  const urgent = msLeft !== null && msLeft < 30 * 60 * 1000 && active;

  let phaseBg = "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)";
  let phaseBorder = "#6366f1";
  let phaseLabel = "Activa";
  let phaseColor = "#a5b4fc";

  if (pending) {
    phaseBg = "linear-gradient(135deg, #1c1917 0%, #292524 100%)";
    phaseBorder = "#78716c";
    phaseLabel = "Próximamente";
    phaseColor = "#d6d3d1";
  } else if (ended) {
    phaseBg = "linear-gradient(135deg, #1c1917 0%, #292524 100%)";
    phaseBorder = "#78716c";
    phaseLabel = "Finalizada";
    phaseColor = "#a8a29e";
  } else if (urgent) {
    phaseBg = "linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)";
    phaseBorder = "#ef4444";
    phaseLabel = "¡Últimos minutos!";
    phaseColor = "#fca5a5";
  } else if (cfg.is_frozen) {
    phaseBg = "linear-gradient(135deg, #0c1a2e 0%, #1e3a5f 100%)";
    phaseBorder = "#3b82f6";
    phaseLabel = "Scoreboard congelado";
    phaseColor = "#93c5fd";
  }

  return (
    <div
      className="rounded-xl p-5 mb-6"
      style={{ background: phaseBg, border: `1px solid ${phaseBorder}`, color: "#fff" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: phaseBorder, color: "#fff" }}
            >
              {phaseLabel}
            </span>
            {cfg.is_frozen && active && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#3b82f6", color: "#fff" }}>
                Congelado
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold leading-tight">{cfg.name}</h2>
          {cfg.description && (
            <p className="text-sm opacity-75 mt-1">{cfg.description}</p>
          )}
          <div className="flex flex-wrap gap-3 mt-3 text-xs opacity-70">
            {start && <span>Inicio: {formatDate(cfg.start_time!)}</span>}
            {end && <span>Fin: {formatDate(cfg.end_time!)}</span>}
            <span>{cfg.challenge_slugs.length} retos · máx {cfg.max_members} por equipo</span>
          </div>
        </div>

        {/* Timer */}
        {(pending || (active && msLeft !== null)) && (
          <div className="text-right shrink-0">
            <p className="text-xs opacity-60 mb-1">
              {pending ? "Comienza en" : "Tiempo restante"}
            </p>
            <p
              className="font-mono font-bold text-2xl tabular-nums"
              style={{ color: phaseColor }}
            >
              {pending && msToStart !== null
                ? formatCountdown(msToStart)
                : msLeft !== null
                ? formatCountdown(msLeft)
                : "—"}
            </p>
          </div>
        )}
      </div>

      {/* Estado del equipo */}
      {team && (
        <div
          className="mt-4 pt-4 flex items-center gap-3 flex-wrap"
          style={{ borderTop: `1px solid ${phaseBorder}40` }}
        >
          <span className="text-sm opacity-60">Tu equipo:</span>
          <span className="font-bold text-sm">{team.name}</span>
          <span className="text-xs opacity-60">
            {team.member_count} miembros · {team.score} pts · {team.solved_count} resueltos
          </span>
        </div>
      )}

      {!team && cfg.mode !== "individual" && !ended && cfg.registration_open && (
        <div
          className="mt-4 pt-4 flex items-center justify-between gap-3"
          style={{ borderTop: `1px solid ${phaseBorder}40` }}
        >
          <p className="text-sm opacity-75">No perteneces a ningún equipo.</p>
          <a
            href="/team"
            className="text-sm font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
            style={{ background: phaseBorder, color: "#fff" }}
          >
            Inscribirse <IconArrowRight className="w-4 h-4 inline ml-1" />
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Vista principal ──────────────────────────────────────────────────────────

export default function CompetitionView() {
  const [cfg, setCfg] = useState<CompetitionConfig | null>(null);
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [filter, setFilter] = useState("Todos");
  const [now, setNow] = useState(new Date());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchCompetitionConfig(), fetchChallenges(false), fetchMyTeam()])
      .then(([c, ch, t]) => {
        setCfg(c);
        setChallenges(ch.sort((a, b) => (ORDER[a.slug] ?? 99) - (ORDER[b.slug] ?? 99)));
        setTeam(t);
      })
      .catch(() => setError("No se pudo cargar la competencia."));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (error) {
    return (
      <div className="card text-center py-12">
        <p className="text-sm" style={{ color: "var(--error)" }}>{error}</p>
        <a href="/challenges" className="btn-ghost mt-4 inline-flex items-center gap-1 text-sm"><IconArrowLeft className="w-4 h-4" /> Ir a entrenamiento</a>
      </div>
    );
  }

  if (!cfg || !challenges) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card animate-pulse">
            <div className="h-5 rounded mb-3 w-1/4" style={{ background: "var(--surface-alt)" }} />
            <div className="h-4 rounded mb-3 w-2/3" style={{ background: "var(--surface-alt)" }} />
            <div className="h-3 rounded mb-2" style={{ background: "var(--surface-alt)" }} />
            <div className="h-3 rounded w-4/5" style={{ background: "var(--surface-alt)" }} />
          </div>
        ))}
      </div>
    );
  }

  if (!cfg.competition_mode) {
    return (
      <div className="card text-center py-12">
        <IconFlag className="w-10 h-10 mx-auto mb-4 opacity-40" />
        <p className="font-bold text-lg" style={{ color: "var(--text)" }}>No hay competencia activa</p>
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
          Cuando el administrador inicie una competencia aparecerá aquí.
        </p>
        <a href="/challenges" className="btn-primary mt-6 inline-flex items-center gap-1">Ir a entrenamiento <IconArrowRight className="w-4 h-4 inline ml-1" /></a>
      </div>
    );
  }

  const end = cfg.end_time ? new Date(cfg.end_time) : null;
  const ended = end && now > end;

  const groups = ["Todos", ...Array.from(new Set(challenges.map(c => getGroup(c.slug))))];
  const filtered = filter === "Todos" ? challenges : challenges.filter(c => getGroup(c.slug) === filter);
  const solved = challenges.filter(c => c.is_solved).length;
  const pct = challenges.length > 0 ? Math.round((solved / challenges.length) * 100) : 0;

  return (
    <div className="animate-fade-in">
      <CompetitionHeader cfg={cfg} team={team} now={now} />

      {/* Si ya terminó, aviso pero igual muestra los retos */}
      {ended && (
        <div
          className="text-sm px-4 py-3 rounded-lg mb-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          La competencia ha finalizado. Los retos se muestran en modo lectura.
        </div>
      )}

      {/* Progreso */}
      {challenges.length > 0 && (
        <div
          className="flex items-center gap-3 mb-6 p-4 rounded-lg"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: "var(--primary)" }}
            />
          </div>
          <span className="text-xs font-semibold shrink-0" style={{ color: "var(--text-muted)" }}>
            {solved}/{challenges.length} resueltos
          </span>
        </div>
      )}

      {/* Filtros */}
      {groups.length > 2 && (
        <div className="flex gap-2 flex-wrap mb-6">
          {groups.map(g => (
            <button
              key={g}
              onClick={() => setFilter(g)}
              className="text-xs font-semibold px-3 py-1.5 rounded transition-colors duration-150"
              style={
                filter === g
                  ? { background: "var(--primary)", color: "#fff" }
                  : { background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }
              }
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {/* Retos */}
      {challenges.length === 0 ? (
        <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
          <IconClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">El administrador aún no ha seleccionado los retos de la competencia.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
          <p className="text-sm">No hay retos en esta categoría.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {filtered.map(c => <ChallengeCard key={c.slug} challenge={c} />)}
        </div>
      )}
    </div>
  );
}
