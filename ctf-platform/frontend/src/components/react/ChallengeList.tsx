import { useEffect, useState } from "react";
import { fetchChallenges } from "../../lib/api";
import type { Challenge } from "../../lib/schemas";
import ChallengeCard from "./ChallengeCard";

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

const CAT_STYLE: Record<string, { bar: string; text: string; activeBg: string; activeBorder: string; activeText: string }> = {
  "Web":     { bar: "#818cf8", text: "#4338ca", activeBg: "#ede9fe", activeBorder: "#c4b5fd", activeText: "#3730a3" },
  "Crypto":  { bar: "#f472b6", text: "#be185d", activeBg: "#fdf2f8", activeBorder: "#f9a8d4", activeText: "#9d174d" },
  "Forense": { bar: "#34d399", text: "#059669", activeBg: "#ecfdf5", activeBorder: "#6ee7b7", activeText: "#065f46" },
};

function getGroup(slug: string): string {
  for (const [group, slugs] of Object.entries(CATEGORY_GROUPS)) {
    if (slugs.includes(slug)) return group;
  }
  return "Otros";
}

export default function ChallengeList({ all = false }: { all?: boolean }) {
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("Todos");

  useEffect(() => {
    fetchChallenges(all)
      .then(data => setChallenges(data.sort((a, b) => (ORDER[a.slug] ?? 99) - (ORDER[b.slug] ?? 99))))
      .catch(e => setError(e.message ?? "Error al cargar retos"));
  }, [all]);

  if (error) {
    return (
      <div role="alert" className="card text-center py-10" style={{ background: "var(--error-bg)", borderColor: "var(--error-border)" }}>
        <p className="text-sm font-medium" style={{ color: "var(--error)" }}>Error al cargar los retos</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{error}</p>
        <button onClick={() => location.reload()} className="btn-ghost mt-4 text-sm">Reintentar</button>
      </div>
    );
  }

  if (!challenges) {
    return (
      <div className="space-y-4">
        {/* Skeleton progreso */}
        <div className="rounded-xl h-28 animate-pulse" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
        {/* Skeleton filtros */}
        <div className="flex gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-8 w-20 rounded-full animate-pulse" style={{ background: "var(--surface-alt)" }} />)}
        </div>
        {/* Skeleton cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card animate-pulse space-y-3">
              <div className="h-5 rounded w-1/4" style={{ background: "var(--surface-alt)" }} />
              <div className="h-4 rounded w-2/3" style={{ background: "var(--surface-alt)" }} />
              <div className="h-3 rounded" style={{ background: "var(--surface-alt)" }} />
              <div className="h-3 rounded w-4/5" style={{ background: "var(--surface-alt)" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const groups = ["Todos", ...Array.from(new Set(challenges.map(c => getGroup(c.slug)).filter(g => g !== "Otros")))];
  const filtered = filter === "Todos" ? challenges : challenges.filter(c => getGroup(c.slug) === filter);
  const solved = challenges.filter(c => c.is_solved).length;
  const pct = challenges.length > 0 ? Math.round((solved / challenges.length) * 100) : 0;

  // Stats por categoría
  const catStats = Object.fromEntries(
    Object.entries(CATEGORY_GROUPS).map(([group, slugs]) => {
      const total = challenges.filter(c => slugs.includes(c.slug)).length;
      const done  = challenges.filter(c => slugs.includes(c.slug) && c.is_solved).length;
      return [group, { total, done }];
    })
  );

  return (
    <div className="animate-fade-in space-y-5">

      {/* ── Panel de progreso ──────────────────────────────────────────── */}
      <div
        className="rounded-xl p-5 overflow-hidden relative"
        style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)", border: "1px solid #4338ca33" }}
      >
        {/* Grid bg */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative">
          {/* Cabecera */}
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-xs font-mono mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>progreso general</p>
              <p className="text-white font-semibold text-sm">
                <span className="font-mono font-bold text-lg" style={{ color: "#FFEE58" }}>{solved}</span>
                <span className="opacity-40 mx-1">/</span>
                <span className="opacity-70">{challenges.length}</span>
                <span className="opacity-40 ml-1.5">retos resueltos</span>
              </p>
            </div>
            <span className="font-mono font-black text-3xl" style={{ color: pct === 100 ? "#34d399" : "#FFEE58" }}>
              {pct}%
            </span>
          </div>

          {/* Barra general */}
          <div className="h-2 rounded-full overflow-hidden mb-4" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: pct === 100 ? "#34d399" : "#FFEE58" }}
            />
          </div>

          {/* Mini barras por categoría */}
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(catStats).map(([group, { total, done }]) => {
              const s = CAT_STYLE[group];
              const catPct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <div key={group}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>{group}</span>
                    <span className="text-[11px] font-mono font-bold" style={{ color: s?.bar ?? "#fff" }}>{done}/{total}</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${catPct}%`, background: s?.bar ?? "#a5b4fc" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Filtros de categoría ───────────────────────────────────────── */}
      {groups.length > 1 && (
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filtrar por categoría">
          {groups.map(group => {
            const active = filter === group;
            const s = CAT_STYLE[group];
            const stats = catStats[group];
            return (
              <button
                key={group}
                onClick={() => setFilter(group)}
                className="text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all duration-150 active:scale-95"
                style={
                  active
                    ? s
                      ? { background: s.activeBg, color: s.activeText, border: `1px solid ${s.activeBorder}` }
                      : { background: "var(--primary)", color: "#fff", border: "1px solid transparent" }
                    : { background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }
                }
              >
                {group}
                {stats && (
                  <span className="ml-1.5 opacity-60 font-mono">
                    {stats.done}/{stats.total}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Grid de retos ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-14 card">
          <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>No hay retos en esta categoría.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {filtered.map(c => (
            <ChallengeCard key={c.slug} challenge={c} />
          ))}
        </div>
      )}
    </div>
  );
}
