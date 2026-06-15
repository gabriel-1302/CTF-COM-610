import { useEffect, useRef, useState } from "react";
import { fetchScoreboard } from "../../lib/api";
import { currentUsername } from "../../lib/auth";
import type { FirstBloodEvent, ScoreboardEntry } from "../../lib/schemas";
import { IconDroplet, IconSnowflake } from "./icons";

const TOP_STYLES: Record<number, { bg: string; border: string; rankColor: string }> = {
  0: { bg: "#f5f3ff", border: "#c3b9f4", rankColor: "#503AA8" },
  1: { bg: "#fafaf9", border: "#e7e5e4", rankColor: "#44403c" },
  2: { bg: "#fffbeb", border: "#fde68a", rankColor: "#92400e" },
};

const MEDAL: Record<1|2|3, { color: string; glow: string; label: string; size: string }> = {
  1: { color: "#F59E0B", glow: "rgba(245,158,11,0.45)", label: "#92400e", size: "w-16 h-16 text-xl" },
  2: { color: "#9CA3AF", glow: "rgba(156,163,175,0.35)", label: "#374151", size: "w-13 h-13 text-base" },
  3: { color: "#B45309", glow: "rgba(180,83,9,0.35)",   label: "#451a03", size: "w-12 h-12 text-sm"  },
};

function usernameInitials(name: string) { return name.slice(0, 2).toUpperCase(); }

function Podium({ entries, me }: { entries: ScoreboardEntry[]; me: string | null }) {
  const top = entries.slice(0, Math.min(3, entries.length));
  if (top.length === 0) return null;

  // Orden visual: 2º izquierda · 1º centro · 3º derecha
  const display: { entry: ScoreboardEntry; pos: 1|2|3; blockH: number }[] =
    top.length === 3
      ? [{ entry: top[1], pos: 2, blockH: 60 }, { entry: top[0], pos: 1, blockH: 88 }, { entry: top[2], pos: 3, blockH: 44 }]
      : top.length === 2
      ? [{ entry: top[1], pos: 2, blockH: 60 }, { entry: top[0], pos: 1, blockH: 88 }]
      : [{ entry: top[0], pos: 1, blockH: 88 }];

  return (
    <div
      className="rounded-xl overflow-hidden mb-4"
      style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)", border: "1px solid #4338ca33" }}
    >
      {/* Fondo grid sutil */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none rounded-xl"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative px-6 pt-5 pb-0">
        <p className="text-center text-[10px] font-mono font-semibold tracking-[0.2em] mb-5" style={{ color: "rgba(255,255,255,0.25)" }}>
          TOP CLASIFICADOS
        </p>

        <div className="flex items-end justify-center gap-4 sm:gap-8">
          {display.map(({ entry, pos, blockH }) => {
            const m = MEDAL[pos];
            const isMe = entry.username === me;
            return (
              <div key={entry.username} className="flex flex-col items-center gap-2">
                {/* Avatar */}
                <div
                  className={`${m.size} rounded-full flex items-center justify-center font-bold select-none shrink-0`}
                  style={{
                    background: `linear-gradient(135deg, ${m.color}cc, ${m.color}88)`,
                    color: "#fff",
                    boxShadow: `0 0 20px ${m.glow}, 0 4px 12px rgba(0,0,0,0.3)`,
                    border: isMe ? "2px solid #FFEE58" : `2px solid ${m.color}66`,
                  }}
                >
                  {usernameInitials(entry.username)}
                </div>
                {/* Nombre + puntos */}
                <div className="text-center">
                  <p className="text-white text-xs font-bold max-w-[76px] truncate leading-tight">
                    {entry.username}
                    {isMe && <span className="ml-0.5" style={{ color: "#FFEE58" }}>★</span>}
                  </p>
                  <p className="font-mono text-xs font-semibold mt-0.5" style={{ color: m.color }}>
                    {entry.score.toLocaleString()} pt
                  </p>
                </div>
                {/* Bloque del podio */}
                <div
                  className="w-20 sm:w-24 rounded-t-md flex items-start justify-center pt-2 font-black text-lg"
                  style={{
                    height: blockH,
                    background: `linear-gradient(to bottom, ${m.color}55, ${m.color}22)`,
                    border: `1px solid ${m.color}44`,
                    borderBottom: "none",
                    color: m.color,
                  }}
                >
                  #{pos}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Scoreboard() {
  const [entries, setEntries] = useState<ScoreboardEntry[] | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [freezeTime, setFreezeTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [live, setLive] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [firstBlood, setFirstBlood] = useState<FirstBloodEvent | null>(null);
  const firstBloodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMe(currentUsername.get());
    const unsub = currentUsername.subscribe(v => setMe(v));
    return unsub;
  }, []);

  useEffect(() => {
    let active = true;

    async function loadHttp() {
      try {
        const res = await fetchScoreboard();
        if (!active) return;
        setEntries(res.entries);
        setFrozen(res.frozen);
        setFreezeTime(res.freeze_time);
        setLastUpdate(new Date());
      } catch (e: any) {
        if (active) setError(e.message ?? "Error al cargar clasificación");
      }
    }

    loadHttp();

    const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${wsProto}://${window.location.host}/ws/scoreboard/`;

    function connectWs() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (active) setLive(true);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "scoreboard_update" && active) {
            setEntries(msg.entries);
            setFrozen(!!msg.frozen);
            setFreezeTime(msg.freeze_time ?? null);
            setLastUpdate(new Date());
          } else if (msg.type === "first_blood" && active) {
            setFirstBlood(msg as FirstBloodEvent);
            if (firstBloodTimer.current) clearTimeout(firstBloodTimer.current);
            firstBloodTimer.current = setTimeout(() => setFirstBlood(null), 8000);
          }
        } catch {}
      };

      ws.onclose = () => {
        if (active) {
          setLive(false);
          wsRef.current = null;
          if (!pollRef.current) pollRef.current = setInterval(loadHttp, 30_000);
        }
      };

      ws.onerror = () => ws.close();
    }

    connectWs();
    const wsTimeout = setTimeout(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        if (!pollRef.current) pollRef.current = setInterval(loadHttp, 30_000);
      }
    }, 3000);

    return () => {
      active = false;
      clearTimeout(wsTimeout);
      if (pollRef.current) clearInterval(pollRef.current);
      if (firstBloodTimer.current) clearTimeout(firstBloodTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div role="alert" className="card" style={{ background: "var(--error-bg)", borderColor: "var(--error-border)" }}>
        <p className="text-sm font-medium" style={{ color: "var(--error)" }}>Error al cargar la clasificación</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{error}</p>
      </div>
    );
  }

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (!entries) {
    return (
      <div className="rounded-lg border animate-pulse overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex gap-4 px-5 py-4 border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="h-4 w-8 rounded" style={{ background: "var(--surface-alt)" }} />
            <div className="h-4 flex-1 rounded" style={{ background: "var(--surface-alt)" }} />
            <div className="h-4 w-16 rounded" style={{ background: "var(--surface-alt)" }} />
            <div className="h-4 w-10 rounded" style={{ background: "var(--surface-alt)" }} />
          </div>
        ))}
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (entries.length === 0) {
    return (
      <div className="card text-center py-16">
        <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>Sin participantes aún</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Sé el primero en resolver un reto.</p>
        <a href="/challenges" className="btn-primary inline-flex mt-5 text-sm">Ver retos</a>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-3">

      {/* ── First blood overlay ───────────────────────────────────────────── */}
      {firstBlood && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          <div
            className="pointer-events-auto mx-4 max-w-md w-full rounded-2xl px-8 py-6 text-center shadow-2xl animate-fade-in"
            style={{
              background: "linear-gradient(135deg, #1a0505 0%, #7f1d1d 50%, #1a0505 100%)",
              border: "2px solid #ef4444",
              boxShadow: "0 0 40px rgba(239,68,68,0.5), 0 0 80px rgba(239,68,68,0.2)",
            }}
            onClick={() => setFirstBlood(null)}
          >
            <IconDroplet className="w-12 h-12 mx-auto mb-3" style={{ color: "#ef4444" }} />
            <p className="text-2xl font-black tracking-tight text-white mb-1">FIRST BLOOD</p>
            <p className="text-lg font-bold" style={{ color: "#fca5a5" }}>
              {firstBlood.challenge_name}
            </p>
            <p className="text-sm mt-2" style={{ color: "#fecaca" }}>
              <strong className="text-white">{firstBlood.username}</strong>
              {firstBlood.team_name ? ` · ${firstBlood.team_name}` : ""}
              <span className="ml-2 font-mono font-bold text-red-300">+{firstBlood.points_earned}pt</span>
            </p>
            <p className="text-xs mt-3 opacity-50 text-white">Clic para cerrar</p>
          </div>
        </div>
      )}

      {/* ── Banner freeze ─────────────────────────────────────────────────── */}
      {frozen && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium"
          style={{
            background: "linear-gradient(135deg, #1A3A7A 0%, #503AA8 100%)",
            color: "#fff",
          }}
        >
          <IconSnowflake className="w-5 h-5 shrink-0" />
          <div className="flex-1">
            <span className="font-bold">Clasificación congelada</span>
            {freezeTime && (
              <span className="ml-2 text-sm opacity-80">
                — puntuaciones al {new Date(freezeTime).toLocaleString("es-BO", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            )}
          </div>
          <span className="text-xs opacity-70 shrink-0">Reveal al final</span>
        </div>
      )}

      {/* ── Podio ─────────────────────────────────────────────────────────── */}
      <Podium entries={entries} me={me} />

      {/* ── Tabla ─────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm" aria-label="Tabla de clasificación CTF USFX">
          <thead>
            <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
              <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide w-14" style={{ color: "var(--text-muted)" }}>Pos.</th>
              <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Participante</th>
              <th scope="col" className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide w-28" style={{ color: "var(--text-muted)" }}>Puntos</th>
              <th scope="col" className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide w-24 hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>Resueltos</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const isMe = entry.username === me;
              const topStyle = TOP_STYLES[i];
              const rowBg = isMe ? "var(--primary-light)" : topStyle ? topStyle.bg : "var(--surface)";
              const rowBorder = topStyle ? topStyle.border : "var(--border)";
              return (
                <tr key={entry.username} style={{ background: rowBg, borderBottom: `1px solid ${rowBorder}` }}>
                  <td className="px-5 py-4 font-mono font-bold text-sm" style={{ color: topStyle ? topStyle.rankColor : "var(--text-faint)" }}>
                    {i < 3 ? (
                      <span
                        className="font-mono font-bold text-xs w-7 h-7 rounded-full flex items-center justify-center"
                        style={{
                          background: i===0?"#F59E0B":i===1?"#9CA3AF":"#B45309",
                          color: "#fff",
                        }}
                      >
                        {i+1}
                      </span>
                    ) : i + 1}
                  </td>
                  <td className="px-5 py-4 font-semibold" style={{ color: "var(--text)" }}>
                    {entry.username}
                    {isMe && (
                      <span className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded" style={{ background: "var(--primary)", color: "#fff" }}>tú</span>
                    )}
                  </td>
                  <td className="px-5 py-4 font-mono font-bold text-right" style={{ color: frozen ? "#1A3A7A" : "var(--primary)" }}>
                    {entry.score.toLocaleString()}
                  </td>
                  <td className="px-5 py-4 font-mono text-right hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>
                    {entry.solved_count}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      {lastUpdate && (
        <p className="text-xs text-right flex items-center justify-end gap-2" style={{ color: "var(--text-faint)" }}>
          {frozen ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#503AA8" }} />
              Congelado
            </span>
          ) : live ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              En vivo
            </span>
          ) : (
            <span>Actualizado: {lastUpdate.toLocaleTimeString()} · cada 30 s</span>
          )}
        </p>
      )}
    </div>
  );
}
