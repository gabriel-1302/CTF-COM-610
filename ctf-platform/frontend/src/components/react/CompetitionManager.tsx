import { useEffect, useRef, useState } from "react";
import {
  fetchCompetitionConfig,
  fetchCompetitionStats,
  fetchTeamScoreboard,
  resetScores,
  resetTeams,
  setCompetitionConfig,
} from "../../lib/api";
import type { CompetitionConfig, CompetitionStats, TeamScoreboardEntry } from "../../lib/schemas";
import ConfirmDialog from "./ConfirmDialog";
import CompetitionWizard from "./CompetitionWizard";
import {
  IconSnowflake, IconStop, IconUser, IconFlag, IconCircleCheck, IconBolt,
  IconPencil, IconTrophy, IconRefresh, IconTrash, IconExclamationTriangle,
  IconInbox, IconDroplet, IconUsers,
} from "./icons";

// ── Helpers ────────────────────────────────────────────────────────────────────

function toLocalDatetimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function toISOOrNull(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  return `hace ${h}h`;
}

const PHASE_LABEL: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  inactive: { label: "INACTIVA",  color: "#6b7280", bg: "#f3f4f6", dot: "#9ca3af" },
  pending:  { label: "PENDIENTE", color: "#d97706", bg: "#fffbeb", dot: "#f59e0b" },
  active:   { label: "ACTIVA",    color: "#059669", bg: "#ecfdf5", dot: "#10b981" },
  frozen:   { label: "CONGELADA", color: "#1A3A7A", bg: "#eff6ff", dot: "#3b82f6" },
  ended:    { label: "FINALIZADA",color: "#7c3aed", bg: "#f5f3ff", dot: "#8b5cf6" },
};

// ── Countdown ──────────────────────────────────────────────────────────────────

function Countdown({ target, label }: { target: string; label: string }) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    function update() {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) { setDisplay("00:00:00"); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setDisplay(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
      {label} <span className="font-mono font-bold" style={{ color: "var(--text)" }}>{display}</span>
    </span>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────────────

function StatCard({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 rounded-xl p-4 text-center"
      style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}
    >
      <span className="flex items-center justify-center w-7 h-7" style={{ color: "var(--primary)" }}>{icon}</span>
      <span className="text-2xl font-black font-mono" style={{ color: "var(--primary)" }}>{value}</span>
      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CompetitionManager() {
  const [config, setConfig] = useState<CompetitionConfig | null>(null);
  const [stats, setStats] = useState<CompetitionStats | null>(null);
  const [teams, setTeams] = useState<TeamScoreboardEntry[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Confirm dialogs
  const [confirmReset, setConfirmReset] = useState<"scores" | "teams" | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial load
  useEffect(() => {
    loadConfig();
    loadStats();
    loadTeams();
    statsIntervalRef.current = setInterval(() => {
      loadStats();
      loadTeams();
    }, 15_000);
    return () => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    };
  }, []);

  async function loadConfig() {
    try {
      const c = await fetchCompetitionConfig();
      setConfig(c);
    } catch {}
  }

  async function loadStats() {
    try {
      const s = await fetchCompetitionStats();
      setStats(s);
    } catch {}
  }

  async function loadTeams() {
    try {
      const t = await fetchTeamScoreboard();
      setTeams(t);
    } catch {}
  }

  async function handleFreezeToggle() {
    if (!config) return;
    try {
      const updated = await setCompetitionConfig({ is_frozen: !config.is_frozen });
      setConfig(updated);
      await loadStats();
    } catch {}
  }

  async function handleEndCompetition() {
    try {
      const updated = await setCompetitionConfig({ end_time: new Date().toISOString() });
      setConfig(updated);
      await loadStats();
    } catch {}
    setConfirmEnd(false);
  }

  async function handleResetConfirm() {
    if (!confirmReset) return;
    try {
      const msg = confirmReset === "scores"
        ? await resetScores()
        : await resetTeams();
      setActionMsg(msg);
      await Promise.all([loadStats(), loadTeams()]);
    } catch {
      setActionMsg("Error al ejecutar la acción");
    } finally {
      setConfirmReset(null);
      setTimeout(() => setActionMsg(null), 4000);
    }
  }

  const phase = stats?.phase ?? "inactive";
  const phaseStyle = PHASE_LABEL[phase] ?? PHASE_LABEL.inactive;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Status bar ──────────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-5 py-4"
        style={{ background: phaseStyle.bg, border: `1px solid ${phaseStyle.dot}30` }}
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-block w-3 h-3 rounded-full animate-pulse"
            style={{ background: phaseStyle.dot }}
          />
          <span className="text-lg font-black tracking-widest" style={{ color: phaseStyle.color }}>
            {phaseStyle.label}
          </span>
          {config?.updated_at && (
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>
              Config actualizada {timeAgo(config.updated_at)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {phase === "pending" && config?.start_time && (
            <Countdown target={config.start_time} label="Inicia en:" />
          )}
          {phase === "active" && config?.end_time && (
            <Countdown target={config.end_time} label="Termina en:" />
          )}
          {phase === "frozen" && config?.end_time && (
            <Countdown target={config.end_time} label="Reveal en:" />
          )}
          {/* Freeze toggle */}
          <button
            onClick={handleFreezeToggle}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-all"
            style={
              config?.is_frozen
                ? { background: "#1A3A7A", color: "#fff", border: "1px solid #1A3A7A" }
                : { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }
            }
          >
            <IconSnowflake className="w-4 h-4 inline mr-1.5" />{config?.is_frozen ? "Descongelar" : "Congelar"}
          </button>

          {/* Terminar competencia — solo visible si está activa o pendiente */}
          {(phase === "active" || phase === "pending") && (
            <button
              onClick={() => setConfirmEnd(true)}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-all"
              style={{ background: "var(--error-bg)", color: "var(--error)", border: "1px solid var(--error-border)" }}
            >
              <IconStop className="w-4 h-4 inline mr-1.5" /> Terminar
            </button>
          )}
        </div>
      </div>

      {/* ── Stats cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard value={stats?.participant_count ?? 0} label="Participantes" icon={<IconUser className="w-5 h-5" />} />
        <StatCard value={stats?.team_count ?? 0} label="Equipos" icon={<IconFlag className="w-5 h-5" />} />
        <StatCard value={stats?.total_solves ?? 0} label="Solves totales" icon={<IconCircleCheck className="w-5 h-5" />} />
        <StatCard value={stats?.solves_last_hour ?? 0} label="Solves / hora" icon={<IconBolt className="w-5 h-5" />} />
      </div>

      {/* ── Config summary + Acciones ───────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Config resumen + wizard */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Configuración activa
            </h2>
            <button
              onClick={() => setWizardOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              <IconPencil className="w-4 h-4 inline mr-1.5" /> {config ? "Editar" : "Crear competencia"}
            </button>
          </div>

          {config ? (
            <div className="space-y-2">
              {[
                { label: "Nombre", value: config.name || "CTF USFX" },
                { label: "Modalidad", value: { individual: "Individual", teams: "Equipos", mixed: "Mixto" }[config.mode ?? "teams"] },
                { label: "Inicio", value: config.start_time ? new Date(config.start_time).toLocaleString("es-BO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—" },
                { label: "Fin", value: config.end_time ? new Date(config.end_time).toLocaleString("es-BO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—" },
                { label: "Freeze", value: config.freeze_time ? new Date(config.freeze_time).toLocaleString("es-BO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—" },
                { label: "Equipos", value: `Máx. ${config.max_teams ?? "∞"} · ${config.max_members ?? 5} miembros` },
                { label: "Scoring", value: config.dynamic_scoring ? `Dinámico · FB ${config.first_blood_bonus_pct}%` : "Estático" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-1.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: "var(--text-faint)" }}>
              <IconTrophy className="w-8 h-8 mx-auto mb-2 opacity-60" />
              <p className="text-sm">No hay competencia configurada</p>
            </div>
          )}

          {/* Modo competencia toggle rápido */}
          {config && (
            <div className="flex items-center justify-between pt-2">
              <div>
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Modo competencia</span>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Activa restricciones de tiempo y equipos</p>
              </div>
              <button
                role="switch"
                aria-checked={config.competition_mode}
                onClick={async () => {
                  const updated = await setCompetitionConfig({ competition_mode: !config.competition_mode });
                  setConfig(updated);
                  await loadStats();
                }}
                className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-4"
                style={{ background: config.competition_mode ? "var(--primary)" : "var(--border)" }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: config.competition_mode ? "translateX(20px)" : "translateX(0)" }}
                />
              </button>
            </div>
          )}
        </div>

        {/* Acciones rápidas */}
        <div className="card space-y-4">
          <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Acciones rápidas
          </h2>

          {actionMsg && (
            <div
              className="text-xs font-medium px-3 py-2 rounded-lg"
              style={{ background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)" }}
            >
              {actionMsg}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => setConfirmReset("scores")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left"
              style={{
                background: "var(--error-bg)",
                color: "var(--error)",
                border: "1px solid var(--error-border)",
              }}
            >
              <IconRefresh className="w-5 h-5 shrink-0" />
              <div>
                <div>Reset Scores</div>
                <div className="text-xs font-normal opacity-70">Borra todos los solves, pistas y puntos</div>
              </div>
            </button>

            <button
              onClick={() => setConfirmReset("teams")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left"
              style={{
                background: "var(--error-bg)",
                color: "var(--error)",
                border: "1px solid var(--error-border)",
              }}
            >
              <IconTrash className="w-5 h-5 shrink-0" />
              <div>
                <div>Disolver Equipos</div>
                <div className="text-xs font-normal opacity-70">Elimina todos los equipos y membresías</div>
              </div>
            </button>
          </div>

          <div className="h-px" style={{ background: "var(--border)" }} />

          <div className="text-xs space-y-1" style={{ color: "var(--text-faint)" }}>
            <p className="flex items-center gap-1"><IconExclamationTriangle className="w-4 h-4 inline shrink-0" /> Estas acciones son <strong>irreversibles</strong>.</p>
            <p>Actualización automática de stats cada 15 segundos.</p>
          </div>
        </div>
      </div>

      {/* ── Activity + Team scoreboard ──────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Activity feed */}
        <div className="card">
          <h2 className="font-bold text-sm uppercase tracking-wide mb-4" style={{ color: "var(--text-muted)" }}>
            Actividad reciente
          </h2>
          {!stats || stats.recent_activity.length === 0 ? (
            <div className="text-center py-8" style={{ color: "var(--text-faint)" }}>
              <IconInbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Sin actividad todavía</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recent_activity.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                  style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}
                >
                  {a.is_first_blood ? <IconDroplet className="w-4 h-4 flex-shrink-0" style={{ color: "#ef4444" }} /> : <IconCircleCheck className="w-4 h-4 flex-shrink-0" style={{ color: "#22c55e" }} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-xs" style={{ color: "var(--text)" }}>
                        {a.username}
                      </span>
                      {a.team_name && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                        >
                          {a.team_name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                      {a.challenge_name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-mono text-xs font-bold" style={{ color: "var(--primary)" }}>
                      +{a.points}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                      {timeAgo(a.solved_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team scoreboard preview */}
        <div className="card">
          <h2 className="font-bold text-sm uppercase tracking-wide mb-4" style={{ color: "var(--text-muted)" }}>
            Ranking equipos
          </h2>
          {teams.length === 0 ? (
            <div className="text-center py-8" style={{ color: "var(--text-faint)" }}>
              <IconFlag className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Sin equipos registrados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {teams.slice(0, 8).map((t, i) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                  style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}
                >
                  {i < 3 ? (
                    <span
                      className="font-mono font-bold text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: i===0?"#F59E0B":i===1?"#9CA3AF":"#B45309",
                        color: "#fff",
                      }}
                    >
                      {i+1}
                    </span>
                  ) : (
                    <span className="font-mono text-sm w-6 text-center font-bold shrink-0" style={{ color: "var(--text-faint)" }}>
                      {i + 1}
                    </span>
                  )}
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: teamColor(t.name) }}
                  >
                    {t.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-xs truncate block" style={{ color: "var(--text)" }}>
                      {t.name}
                    </span>
                    <span className="text-xs inline-flex items-center gap-1" style={{ color: "var(--text-faint)" }}>
                      <IconUsers className="w-3.5 h-3.5" /> {t.member_count} · {t.solved_count} retos
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sm" style={{ color: "var(--primary)" }}>
                    {t.score.toLocaleString()}
                  </span>
                </div>
              ))}
              {teams.length > 8 && (
                <p className="text-xs text-center pt-1" style={{ color: "var(--text-faint)" }}>
                  +{teams.length - 8} equipos más · <a href="/scoreboard?tab=teams" className="underline">Ver ranking completo</a>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Confirm dialogs ─────────────────────────────────────────────────── */}
      {confirmReset === "scores" && (
        <ConfirmDialog
          title="¿Resetear todos los scores?"
          description="Se eliminarán TODOS los solves, pistas desbloqueadas y puntos de usuarios y equipos. Esta acción es irreversible."
          confirmLabel="Sí, resetear"
          cancelLabel="Cancelar"
          onConfirm={handleResetConfirm}
          onClose={() => setConfirmReset(null)}
        />
      )}
      {confirmReset === "teams" && (
        <ConfirmDialog
          title="¿Disolver todos los equipos?"
          description="Se eliminarán TODOS los equipos y membresías. Los usuarios quedarán sin equipo. Esta acción es irreversible."
          confirmLabel="Sí, disolver"
          cancelLabel="Cancelar"
          onConfirm={handleResetConfirm}
          onClose={() => setConfirmReset(null)}
        />
      )}

      {/* ── Terminar competencia ────────────────────────────────────────────── */}
      {confirmEnd && (
        <ConfirmDialog
          title="¿Terminar la competencia ahora?"
          description="Se fijará el fin al momento actual. Los participantes ya no podrán submitir flags. Puedes reabrir la competencia editando la fecha de fin."
          confirmLabel="Sí, terminar"
          cancelLabel="Cancelar"
          onConfirm={handleEndCompetition}
          onClose={() => setConfirmEnd(false)}
        />
      )}

      {/* ── Wizard ──────────────────────────────────────────────────────────── */}
      {wizardOpen && config && (
        <CompetitionWizard
          initial={config}
          onClose={() => setWizardOpen(false)}
          onSaved={updated => {
            setConfig(updated);
            setWizardOpen(false);
            loadStats();
          }}
        />
      )}
    </div>
  );
}

function teamColor(name: string): string {
  const palette = ["#503AA8", "#1A3A7A", "#2563EB", "#059669", "#D97706", "#7C3AED", "#DB2777", "#0891B2"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}
