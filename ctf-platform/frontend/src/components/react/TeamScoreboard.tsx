import { useEffect, useRef, useState } from "react";
import { fetchTeamScoreboard } from "../../lib/api";
import { currentUsername } from "../../lib/auth";
import type { TeamScoreboardEntry } from "../../lib/schemas";
import { IconFlag, IconUsers } from "./icons";

export default function TeamScoreboard() {
  const [entries, setEntries] = useState<TeamScoreboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTeam, setMyTeam] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const data = await fetchTeamScoreboard();
      setEntries(data);
    } catch {
      // silencioso: mantiene datos anteriores
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // También necesitamos saber el equipo del usuario para resaltarlo.
  // Lo obtenemos de fetchMyTeam para no hacer doble fetch, pero TeamScoreboard
  // es independiente. Usamos currentUsername y buscamos en los miembros si fuera
  // necesario. Por ahora, no hay acceso al nombre del equipo del usuario desde
  // el scoreboard público, así que lo dejamos sin resalte en esta vista.

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="card text-center py-14" style={{ color: "var(--text-muted)" }}>
        <IconFlag className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Aún no hay equipos registrados.</p>
        <p className="text-sm mt-1">Crea un equipo y sé el primero en el ranking.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
              <th className="py-3 px-4 text-left font-semibold w-12" style={{ color: "var(--text-muted)" }}>#</th>
              <th className="py-3 px-4 text-left font-semibold" style={{ color: "var(--text-muted)" }}>Equipo</th>
              <th className="py-3 px-4 text-center font-semibold" style={{ color: "var(--text-muted)" }}>Miembros</th>
              <th className="py-3 px-4 text-right font-semibold" style={{ color: "var(--text-muted)" }}>Retos</th>
              <th className="py-3 px-4 text-right font-semibold" style={{ color: "var(--text-muted)" }}>Puntos</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => {
              const rank = idx + 1;
              const isTop3 = rank <= 3;

              return (
                <tr
                  key={entry.id}
                  style={{
                    background: isTop3 ? "var(--surface-alt)" : "var(--surface)",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <td className="py-3.5 px-4">
                    {isTop3 ? (
                      <span
                        className="font-mono font-bold text-xs w-7 h-7 rounded-full flex items-center justify-center"
                        style={{
                          background: rank===1?"#F59E0B":rank===2?"#9CA3AF":"#B45309",
                          color: "#fff",
                        }}
                      >
                        {rank}
                      </span>
                    ) : (
                      <span className="font-mono text-xs font-medium" style={{ color: "var(--text-faint)" }}>
                        {rank}
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      {/* Team avatar */}
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: teamColor(entry.name) }}
                      >
                        {entry.name[0].toUpperCase()}
                      </div>
                      <div>
                        <span className="font-semibold" style={{ color: isTop3 ? "var(--text)" : "var(--text)" }}>
                          {entry.name}
                        </span>
                        {entry.captain_username && (
                          <span className="text-xs ml-1.5" style={{ color: "var(--text-faint)" }}>
                            cap: {entry.captain_username}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    <span
                      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                    >
                      <IconUsers className="w-3.5 h-3.5" /> {entry.member_count}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right font-mono text-sm" style={{ color: "var(--text-muted)" }}>
                    {entry.solved_count}
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <span
                      className="font-bold font-mono"
                      style={{ color: isTop3 ? "var(--primary)" : "var(--text)" }}
                    >
                      {entry.score.toLocaleString()}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs mt-3 text-right" style={{ color: "var(--text-faint)" }}>
        Actualización automática cada 30 segundos
      </p>
    </div>
  );
}

function teamColor(name: string): string {
  const palette = ["#503AA8", "#1A3A7A", "#2563EB", "#059669", "#D97706", "#7C3AED", "#DB2777", "#0891B2"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}
