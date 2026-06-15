import { useEffect, useState, useMemo, useRef } from "react";
import { fetchAdminStudents, fetchAdminChallenges, toggleChallenge, fetchSolucionario } from "../../lib/api";
import type { AdminStudent, AdminChallenge } from "../../lib/schemas";
import { showToast } from "../../lib/toast";
import { IconBookOpen, IconX, IconRefresh, IconTrophy, IconArrowRight } from "./icons";

// ─── Nivel system ─────────────────────────────────────────────────────────────
const LEVELS = [
  { name: "Estudiante",   min: 0,    color: "#6b7280", bg: "#f3f4f6",              border: "#d1d5db" },
  { name: "Analista",     min: 500,  color: "#3b82f6", bg: "#eff6ff",              border: "#bfdbfe" },
  { name: "Hacker",       min: 1000, color: "#503AA8", bg: "var(--primary-light)", border: "var(--primary-border)" },
  { name: "Especialista", min: 1600, color: "#d97706", bg: "#fffbeb",              border: "#fde68a" },
  { name: "Elite USFX",   min: 2200, color: "#059669", bg: "#f0fdf4",              border: "#bbf7d0" },
] as const;

function getLevel(score: number): (typeof LEVELS)[number] {
  let cur: (typeof LEVELS)[number] = LEVELS[0];
  for (const l of LEVELS) { if (score >= l.min) cur = l; else break; }
  return cur;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "hoy";
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d}d`;
  if (d < 30) return `hace ${Math.floor(d / 7)}s`;
  return `hace ${Math.floor(d / 30)}m`;
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="w-16 h-1.5 rounded-full shrink-0 overflow-hidden" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono" style={{ color }}>
        {value}/{max}
      </span>
    </div>
  );
}

// ─── Toggle button para challenge ─────────────────────────────────────────────
function ToggleBtn({
  slug, isActive, onToggle,
}: { slug: string; isActive: boolean; onToggle: (slug: string, newState: boolean) => void }) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try {
      await toggleChallenge(slug);
      onToggle(slug, !isActive);
      showToast("success", isActive ? "Reto desactivado." : "Reto activado.");
    } catch {
      showToast("error", "Error al cambiar estado del reto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded transition-all disabled:opacity-50"
      style={{
        background: isActive ? "var(--success-bg)" : "var(--surface-alt)",
        color: isActive ? "var(--success)" : "var(--text-faint)",
        border: `1px solid ${isActive ? "var(--success-border)" : "var(--border)"}`,
      }}
    >
      {loading ? (
        <span className="w-2 h-2 rounded-full animate-pulse inline-block" style={{ background: "currentColor" }} />
      ) : (
        <span className="w-2 h-2 rounded-full inline-block" style={{ background: isActive ? "var(--success)" : "var(--text-faint)" }} />
      )}
      {isActive ? "Activo" : "Inactivo"}
    </button>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card text-center py-4 px-3">
      <div className="text-2xl font-bold font-mono" style={{ color: "var(--primary)" }}>{value}</div>
      <div className="text-xs mt-0.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>{sub}</div>}
    </div>
  );
}

// ─── Solucionario modal ───────────────────────────────────────────────────────
function SolucionarioModal({ slug, name, onClose }: { slug: string; name: string; onClose: () => void }) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSolucionario(slug).then(({ html, found }) => {
      setHtml(html);
      setNotFound(!found);
      setLoading(false);
    }).catch(() => {
      setNotFound(true);
      setLoading(false);
    });
  }, [slug]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto animate-overlay-in"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="solucionario-modal-title"
    >
      <div
        ref={dialogRef}
        className="card w-full max-w-3xl my-8 animate-slide-up"
        style={{ minHeight: "200px" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <IconBookOpen className="w-5 h-5" style={{ color: "var(--primary)" }} />
            <div>
              <h3 id="solucionario-modal-title" className="text-base font-bold" style={{ color: "var(--text)" }}>
                Solucionario
              </h3>
              <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text-faint)" }}>{name} · {slug}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded transition-colors"
            style={{ color: "var(--text-faint)" }}
            aria-label="Cerrar solucionario"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {loading && (
          <div className="space-y-3 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 rounded" style={{ background: "var(--border)", width: i % 3 === 0 ? "60%" : "100%" }} />
            ))}
          </div>
        )}

        {!loading && notFound && (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-faint)" }}>
            No se encontró solucionario para <strong>{slug}</strong>.
          </p>
        )}

        {!loading && html && (
          <div
            className="solucionario-content"
            style={{ lineHeight: "1.7", color: "var(--text)" }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>

      <style>{`
        .solucionario-content h1,.solucionario-content h2,.solucionario-content h3 {
          font-weight: 700; margin: 1.2em 0 0.5em; color: var(--primary);
          border-bottom: 1px solid var(--border); padding-bottom: 4px;
        }
        .solucionario-content h1 { font-size: 1.3em; }
        .solucionario-content h2 { font-size: 1.1em; }
        .solucionario-content h3 { font-size: 1em; border: none; }
        .solucionario-content p { margin: 0.6em 0; }
        .solucionario-content code {
          background: var(--surface-alt); padding: 2px 6px; border-radius: 4px;
          font-family: monospace; font-size: 0.88em; color: var(--primary);
        }
        .solucionario-content pre {
          background: #1e1e2e; color: #cdd6f4; padding: 14px 16px;
          border-radius: 8px; overflow-x: auto; margin: 1em 0;
        }
        .solucionario-content pre code { background: none; padding: 0; color: inherit; font-size: 0.85em; }
        .solucionario-content blockquote {
          border-left: 3px solid var(--primary); margin: 0;
          padding: 8px 14px; background: var(--primary-light); border-radius: 0 6px 6px 0;
        }
        .solucionario-content table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        .solucionario-content th,.solucionario-content td {
          border: 1px solid var(--border); padding: 7px 12px; text-align: left; font-size: 0.9em;
        }
        .solucionario-content th { background: var(--primary); color: #fff; font-weight: 600; }
        .solucionario-content ul,.solucionario-content ol { padding-left: 1.4em; margin: 0.6em 0; }
        .solucionario-content li { margin: 0.3em 0; }
        .solucionario-content a { color: var(--primary); text-decoration: underline; }
      `}</style>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [challenges, setChallenges] = useState<AdminChallenge[]>([]);
  const [totalChallenges, setTotalChallenges] = useState(14);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solucionario, setSolucionario] = useState<{ slug: string; name: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [studData, chalData] = await Promise.all([
        fetchAdminStudents(),
        fetchAdminChallenges(),
      ]);
      setStudents(studData.students);
      setTotalChallenges(studData.total_challenges);
      setChallenges(chalData);
    } catch (e: any) {
      setError(e?.response?.status === 403 ? "Acceso denegado. Se requiere rol de administrador." : "Error al cargar datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleToggle = (slug: string, newState: boolean) => {
    setChallenges(prev =>
      prev.map(c => c.slug === slug ? { ...c, is_active: newState } : c)
    );
  };

  const filtered = useMemo(
    () => students.filter(s =>
      s.username.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
    ),
    [students, search]
  );

  const avgScore = students.length > 0
    ? Math.round(students.reduce((a, s) => a + s.score, 0) / students.length)
    : 0;
  const activeStudents = students.filter(s => s.score > 0).length;
  const topChallenge = [...challenges].sort((a, b) => b.solve_count - a.solve_count)[0];
  const hardestChallenge = [...challenges]
    .filter(c => c.is_active)
    .sort((a, b) => a.solve_count - b.solve_count)[0];

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse max-w-5xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="card h-20" />)}
        </div>
        <div className="card h-64" />
        <div className="card h-48" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center py-12 max-w-xl mx-auto">
        <p style={{ color: "var(--error)" }}>{error}</p>
        <button onClick={load} className="btn-primary inline-flex mt-4 text-sm">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Panel de Administración</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Visión general de la competencia y gestión de retos
          </p>
        </div>
        <button onClick={load} className="btn-ghost text-sm py-1.5 px-3 flex items-center gap-1.5">
          <IconRefresh className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {/* ── Stats overview ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Estudiantes" value={students.length} sub={`${activeStudents} con puntos`} />
        <StatCard label="Prom. puntos" value={avgScore.toLocaleString()} />
        <StatCard
          label="Reto más resuelto"
          value={topChallenge?.solve_count ?? "—"}
          sub={topChallenge?.name.slice(0, 18) ?? ""}
        />
        <StatCard
          label="Reto más difícil"
          value={hardestChallenge?.solve_count ?? "—"}
          sub={hardestChallenge?.name.slice(0, 18) ?? ""}
        />
      </div>

      {/* ── Acceso rápido a Gestión de Competencia ──────────────────── */}
      <a
        href="/admin/competencia"
        className="flex items-center justify-between px-5 py-4 rounded-xl transition-all group"
        style={{ background: "var(--primary-light)", border: "1px solid var(--primary-border)" }}
      >
        <div className="flex items-center gap-3">
          <IconTrophy className="w-6 h-6" style={{ color: "var(--primary)" }} />
          <div>
            <p className="font-semibold text-sm" style={{ color: "var(--primary)" }}>Gestión de Competencia</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Configurar fechas, modo competencia, freeze, reset y actividad en tiempo real
            </p>
          </div>
        </div>
        <IconArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" style={{ color: "var(--primary)" }} />
      </a>

      {solucionario && (
        <SolucionarioModal
          slug={solucionario.slug}
          name={solucionario.name}
          onClose={() => setSolucionario(null)}
        />
      )}

      {/* ── Estudiantes ──────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Estudiantes ({filtered.length}{search ? ` de ${students.length}` : ""})
          </h2>
          <input
            type="search"
            placeholder="Buscar estudiante..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field text-sm py-1.5 w-full sm:w-56"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "var(--text-faint)" }}>
            {search ? "Sin resultados para esa búsqueda." : "Sin estudiantes registrados."}
          </p>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["#", "Usuario", "Nivel", "Puntos", "Resueltos", "Categorías", "Pistas", "Registro"].map(h => (
                    <th key={h} className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--text-faint)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const level = getLevel(s.score);
                  return (
                    <tr
                      key={s.id}
                      className="transition-colors"
                      style={{ borderBottom: "1px solid var(--border-subtle)" }}
                    >
                      <td className="py-2.5 pr-4 font-mono text-xs font-bold w-8"
                        style={{ color: "var(--text-faint)" }}>
                        {s.rank}
                      </td>
                      <td className="py-2.5 pr-4">
                        <a href={`/profile?u=${s.username}`}
                          className="font-semibold hover:underline"
                          style={{ color: "var(--text)" }}>
                          {s.username}
                        </a>
                        <div className="text-xs" style={{ color: "var(--text-faint)" }}>{s.email}</div>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: level.bg, color: level.color, border: `1px solid ${level.border}` }}>
                          {level.name}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 font-mono font-bold"
                        style={{ color: "var(--primary)" }}>
                        {s.score.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Bar value={s.solved_count} max={totalChallenges} color="var(--primary)" />
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex gap-2 text-xs font-mono">
                          <span style={{ color: "#503AA8" }}>{s.web_solved}/10</span>
                          <span style={{ color: "#d97706" }}>{s.crypto_solved}/2</span>
                          <span style={{ color: "#059669" }}>{s.forense_solved}/2</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-sm"
                        style={{ color: s.hints_used > 0 ? "var(--error)" : "var(--text-faint)" }}>
                        {s.hints_used > 0 ? s.hints_used : "—"}
                      </td>
                      <td className="py-2.5 text-xs" style={{ color: "var(--text-faint)" }}>
                        {timeAgo(s.date_joined)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Gestión de retos ─────────────────────────────────────────── */}
      <div className="card">
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
          Gestión de Retos
        </h2>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Reto", "Pts", "Resuelto por", "Estado", ""].map(h => (
                  <th key={h} className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-faint)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {challenges.map(c => (
                <tr
                  key={c.slug}
                  className="transition-colors"
                  style={{
                    borderBottom: "1px solid var(--border-subtle)",
                    opacity: c.is_active ? 1 : 0.55,
                  }}
                >
                  <td className="py-2.5 pr-4">
                    <span className="font-medium" style={{ color: "var(--text)" }}>{c.name}</span>
                    <div className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>{c.slug}</div>
                  </td>
                  <td className="py-2.5 pr-4 font-mono font-bold text-xs" style={{ color: "var(--primary)" }}>
                    {c.points}
                  </td>
                  <td className="py-2.5 pr-4">
                    <Bar
                      value={c.solve_count}
                      max={c.total_students || 1}
                      color={c.is_active ? "var(--primary)" : "var(--text-faint)"}
                    />
                  </td>
                  <td className="py-2.5">
                    <ToggleBtn slug={c.slug} isActive={c.is_active} onToggle={handleToggle} />
                  </td>
                  <td className="py-2.5">
                    <button
                      onClick={() => setSolucionario({ slug: c.slug, name: c.name })}
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded transition-colors"
                      style={{ color: "var(--primary)", background: "var(--primary-light)", border: "1px solid var(--primary-border)" }}
                      aria-label={`Ver solucionario de ${c.name}`}
                    >
                      <IconBookOpen className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Solucionario</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
