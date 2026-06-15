import { useEffect, useState } from "react";
import { fetchProfile } from "../../lib/api";
import type { Profile } from "../../lib/schemas";
import {
  IconFlag, IconCpuChip, IconMapPin, IconGlobe, IconLockClosed,
  IconMagnifyingGlass, IconTrophy, IconStar,
} from "./icons";

// ─── Challenge metadata ────────────────────────────────────────────────────
const CATEGORIES = ["Web", "Crypto", "Forense"] as const;
type Category = typeof CATEGORIES[number];

const CHALLENGE_CATEGORY: Record<string, Category> = {
  sqli: "Web", cmdi: "Web", xss: "Web", lfi: "Web",
  "path-traversal": "Web", ssti: "Web", idor: "Web",
  "format-string": "Web", jwt: "Web", xxe: "Web",
  "crypto-rsa": "Crypto", "crypto-vigenere": "Crypto",
  "forensics-pcap": "Forense", stego: "Forense",
};

const CATEGORY_TOTALS: Record<Category, number> = { Web: 10, Crypto: 2, Forense: 2 };
const TOTAL_CHALLENGES = 14;

// ─── Level system ──────────────────────────────────────────────────────────
const LEVELS = [
  { name: "Estudiante",   min: 0,    color: "#6b7280", bg: "#f3f4f6",         border: "#d1d5db" },
  { name: "Analista",     min: 500,  color: "#3b82f6", bg: "#eff6ff",         border: "#bfdbfe" },
  { name: "Hacker",       min: 1000, color: "#503AA8", bg: "var(--primary-light)", border: "var(--primary-border)" },
  { name: "Especialista", min: 1600, color: "#d97706", bg: "#fffbeb",         border: "#fde68a" },
  { name: "Elite USFX",   min: 2200, color: "#059669", bg: "#f0fdf4",         border: "#bbf7d0" },
] as const;

type Level = typeof LEVELS[number];

function getLevel(score: number): { current: Level; next: Level | null } {
  let current: Level = LEVELS[0];
  for (const lvl of LEVELS) {
    if (score >= lvl.min) current = lvl as Level;
    else break;
  }
  const idx = LEVELS.findIndex(l => l.name === current.name);
  const next = idx < LEVELS.length - 1 ? LEVELS[idx + 1] as Level : null;
  return { current, next };
}

function getLevelPct(score: number): number {
  const { current, next } = getLevel(score);
  if (!next) return 100;
  const range = next.min - current.min;
  return Math.min(100, Math.round(((score - current.min) / range) * 100));
}

// ─── Avatar color ──────────────────────────────────────────────────────────
function usernameColor(username: string): string {
  let hash = 0;
  for (const ch of username) {
    hash = ch.charCodeAt(0) + ((hash << 5) - hash);
    hash |= 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 55%, 38%)`;
}

// ─── Badges ────────────────────────────────────────────────────────────────
interface Badge {
  id: string;
  icon: React.ReactNode;
  name: string;
  description: string;
  earned: boolean;
}

function computeBadges(profile: Profile): Badge[] {
  const hintSlugs = new Set(profile.hints_used_slugs);
  const byCategory = Object.fromEntries(
    CATEGORIES.map(cat => [
      cat,
      profile.solves.filter(s => CHALLENGE_CATEGORY[s.challenge_slug] === cat).length,
    ])
  ) as Record<Category, number>;
  const cleanSolves = profile.solves.filter(s => !hintSlugs.has(s.challenge_slug)).length;

  return [
    {
      id: "primer_paso",
      icon: <IconFlag className="w-6 h-6 mx-auto" />,
      name: "Primer Paso",
      description: "Resolviste tu primer reto",
      earned: profile.solves.length >= 1,
    },
    {
      id: "sin_ayuda",
      icon: <IconCpuChip className="w-6 h-6 mx-auto" />,
      name: "Sin Ayuda",
      description: "3 retos resueltos sin pistas",
      earned: cleanSolves >= 3,
    },
    {
      id: "explorador",
      icon: <IconMapPin className="w-6 h-6 mx-auto" />,
      name: "Explorador",
      description: "Un reto de cada categoría",
      earned: byCategory.Web >= 1 && byCategory.Crypto >= 1 && byCategory.Forense >= 1,
    },
    {
      id: "dominador_web",
      icon: <IconGlobe className="w-6 h-6 mx-auto" />,
      name: "Dominador Web",
      description: "Todos los retos Web completados",
      earned: byCategory.Web === CATEGORY_TOTALS.Web,
    },
    {
      id: "criptografo",
      icon: <IconLockClosed className="w-6 h-6 mx-auto" />,
      name: "Criptógrafo",
      description: "Ambos retos de Criptografía resueltos",
      earned: byCategory.Crypto === CATEGORY_TOTALS.Crypto,
    },
    {
      id: "forense",
      icon: <IconMagnifyingGlass className="w-6 h-6 mx-auto" />,
      name: "Forense Digital",
      description: "Ambos retos de Forense completados",
      earned: byCategory.Forense === CATEGORY_TOTALS.Forense,
    },
    {
      id: "perfeccion",
      icon: <IconStar className="w-6 h-6 mx-auto" />,
      name: "Perfección",
      description: "Los 14 retos completados",
      earned: profile.solved_count >= TOTAL_CHALLENGES,
    },
    {
      id: "sin_penalizacion",
      icon: <IconTrophy className="w-6 h-6 mx-auto" />,
      name: "Sin Penalización",
      description: "Completaste retos sin usar pistas",
      earned: profile.hints_used === 0 && profile.solved_count > 0,
    },
  ];
}

// ─── Radar / spider chart (SVG puro, sin dependencias) ────────────────────
function RadarChart({ data }: {
  data: { label: string; value: number; color: string }[];
}) {
  const cx = 100, cy = 100, r = 62;
  const angles = data.map((_, i) => (i * (2 * Math.PI)) / data.length - Math.PI / 2);

  const pt = (angle: number, radius: number): [number, number] => [
    cx + radius * Math.cos(angle),
    cy + radius * Math.sin(angle),
  ];

  const gridPoints = (scale: number) =>
    angles.map(a => pt(a, scale * r).map(v => v.toFixed(1)).join(",")).join(" ");

  const userPts = data.map((d, i) => pt(angles[i], Math.max(d.value, 0.01) * r));
  const userPath =
    userPts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") + " Z";

  return (
    <svg
      viewBox="0 0 200 175"
      style={{ width: "100%", maxWidth: 200, display: "block", margin: "0 auto" }}
      aria-label="Gráfico de habilidades por categoría"
    >
      {/* Grid background */}
      {[0.25, 0.5, 0.75, 1].map(lvl => (
        <polygon
          key={lvl}
          points={gridPoints(lvl)}
          style={{
            fill: lvl === 1 ? "#f0edfc" : "none",
            stroke: "#ddd8fb",
            strokeWidth: lvl === 1 ? 1 : 0.5,
          }}
        />
      ))}

      {/* Axis lines */}
      {angles.map((a, i) => {
        const [x, y] = pt(a, r);
        return (
          <line key={i} x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)}
            style={{ stroke: "#ddd8fb", strokeWidth: 0.8 }} />
        );
      })}

      {/* User polygon */}
      <path d={userPath} style={{
        fill: "rgba(80,58,168,0.13)",
        stroke: "#503AA8",
        strokeWidth: 2,
        strokeLinejoin: "round" as const,
      }} />

      {/* Vertex dots */}
      {userPts.map(([x, y], i) => (
        <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={3.5}
          style={{ fill: data[i].color, stroke: "white", strokeWidth: 1.5 }} />
      ))}

      {/* Labels (category name + percentage) */}
      {data.map((d, i) => {
        const [lx, ly] = pt(angles[i], r + 17);
        return (
          <g key={i}>
            <text x={lx.toFixed(1)} y={(ly - 5).toFixed(1)}
              textAnchor="middle" fontSize={8.5} fontWeight={600}
              style={{ fill: "#54486e", fontFamily: "Manrope, sans-serif" }}>
              {d.label}
            </text>
            <text x={lx.toFixed(1)} y={(ly + 6).toFixed(1)}
              textAnchor="middle" fontSize={7.5} fontWeight={700}
              style={{ fill: d.color, fontFamily: "'JetBrains Mono', monospace" }}>
              {Math.round(d.value * 100)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Mini progress bar ─────────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export default function UserProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile()
      .then(setProfile)
      .catch(e => setError(e?.response?.data?.detail ?? "Error al cargar perfil"));
  }, []);

  if (error) {
    return (
      <div className="card text-center py-12">
        <p style={{ color: "var(--error)" }}>{error}</p>
        <a href="/login" className="btn-primary inline-flex mt-4 text-sm">Iniciar sesión</a>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="card h-40" />
        <div className="card h-52" />
        <div className="card h-44" />
        <div className="card h-64" />
      </div>
    );
  }

  const joinDate = new Date(profile.date_joined).toLocaleDateString("es-ES", {
    year: "numeric", month: "long", day: "numeric",
  });

  const rankLabel =
    profile.rank === 1 ? "#1"
    : profile.rank === 2 ? "#2"
    : profile.rank === 3 ? "#3"
    : `#${profile.rank}`;

  const rankColor =
    profile.rank === 1 ? "#F59E0B"
    : profile.rank === 2 ? "#9CA3AF"
    : profile.rank === 3 ? "#B45309"
    : undefined;

  const { current: level, next: nextLevel } = getLevel(profile.score);
  const levelPct = getLevelPct(profile.score);

  const grossPoints = profile.solves.reduce((sum, s) => sum + s.points, 0);
  const hintsLost = grossPoints - profile.score;

  const percentile =
    profile.total_players > 1
      ? Math.round((1 - (profile.rank - 1) / profile.total_players) * 100)
      : 100;

  const catSolved = Object.fromEntries(
    CATEGORIES.map(cat => [
      cat,
      profile.solves.filter(s => CHALLENGE_CATEGORY[s.challenge_slug] === cat).length,
    ])
  ) as Record<Category, number>;

  const catColors: Record<Category, string> = {
    Web: "var(--primary)",
    Crypto: "#d97706",
    Forense: "#059669",
  };

  const badges = computeBadges(profile);
  const earnedCount = badges.filter(b => b.earned).length;

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl mx-auto">

      {/* ── Header con hero ────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>

        {/* Zona gradiente */}
        <div
          className="relative overflow-hidden px-6 pt-8 pb-7"
          style={{ background: "radial-gradient(ellipse at 65% 45%, #5d3ecf 0%, #3d2c88 50%, #1a0f40 100%)" }}
        >
          {/* Grid pattern */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-end gap-5">
            {/* Avatar grande */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold shrink-0 select-none"
              style={{
                background: usernameColor(profile.username),
                color: "#fff",
                boxShadow: "0 0 0 4px rgba(255,255,255,0.15), 0 8px 32px rgba(0,0,0,0.35)",
              }}
            >
              {profile.username.slice(0, 2).toUpperCase()}
            </div>

            {/* Nombre + meta */}
            <div className="flex-1 min-w-0 text-white">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold tracking-tight">{profile.username}</h1>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
                >
                  {level.name}
                </span>
              </div>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{profile.email}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Miembro desde {joinDate}</p>
            </div>

            {/* Puntos + Ranking */}
            <div className="flex gap-7 shrink-0">
              <div className="text-center">
                <p className="text-3xl font-bold font-mono" style={{ color: "#FFEE58" }}>
                  {profile.score.toLocaleString()}
                </p>
                <p className="text-xs uppercase tracking-wide mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>puntos</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold font-mono" style={{ color: rankColor ?? "#fff" }}>
                  {rankLabel}
                </p>
                <p className="text-xs uppercase tracking-wide mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>ranking</p>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de nivel — sobre fondo blanco */}
        <div className="px-6 py-5" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold" style={{ color: level.color }}>{level.name}</span>
            {nextLevel ? (
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                {(nextLevel.min - profile.score).toLocaleString()} pts para{" "}
                <span style={{ color: nextLevel.color }}>{nextLevel.name}</span>
              </span>
            ) : (
              <span className="text-xs font-semibold" style={{ color: level.color }}>Nivel máximo alcanzado</span>
            )}
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${levelPct}%`, background: level.color }}
            />
          </div>
          <p className="text-xs mt-1.5" style={{ color: "var(--text-faint)" }}>
            {levelPct}% del nivel actual completado
          </p>
        </div>
      </div>

      {/* ── Progreso ───────────────────────────────────────────────────── */}
      <div className="card space-y-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Progreso
        </h2>

        {/* Barra general */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Retos completados</span>
            <span className="text-sm font-bold font-mono" style={{ color: "var(--primary)" }}>
              {profile.solved_count} / {TOTAL_CHALLENGES}
            </span>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.round((profile.solved_count / TOTAL_CHALLENGES) * 100)}%`,
                background: "var(--primary)",
              }}
            />
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
            {Math.round((profile.solved_count / TOTAL_CHALLENGES) * 100)}% de la plataforma completado
          </p>
        </div>

        {/* Categorías + radar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
          <div className="space-y-2.5">
            {CATEGORIES.map(cat => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-xs w-24 shrink-0" style={{ color: "var(--text-muted)" }}>
                  {cat === "Crypto" ? "Criptografía" : cat}
                </span>
                <MiniBar value={catSolved[cat]} max={CATEGORY_TOTALS[cat]} color={catColors[cat]} />
                <span
                  className="text-xs font-mono font-bold w-10 text-right shrink-0"
                  style={{ color: catColors[cat] }}
                >
                  {catSolved[cat]}/{CATEGORY_TOTALS[cat]}
                </span>
              </div>
            ))}
          </div>
          <RadarChart
            data={CATEGORIES.map(cat => ({
              label: cat === "Crypto" ? "Crypto" : cat,
              value: CATEGORY_TOTALS[cat] > 0 ? catSolved[cat] / CATEGORY_TOTALS[cat] : 0,
              color: cat === "Web" ? "#503AA8" : cat === "Crypto" ? "#d97706" : "#059669",
            }))}
          />
        </div>

        <div style={{ borderTop: "1px solid var(--border)" }} />

        {/* Stats de puntos y posición */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="text-center">
            <div className="text-xl font-bold font-mono" style={{ color: "var(--success)" }}>
              +{grossPoints.toLocaleString()}
            </div>
            <div className="text-xs mt-0.5 uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
              pts brutos
            </div>
          </div>

          <div className="text-center">
            <div
              className="text-xl font-bold font-mono"
              style={{ color: hintsLost > 0 ? "var(--error)" : "var(--text-faint)" }}
            >
              {hintsLost > 0 ? `-${hintsLost.toLocaleString()}` : "—"}
            </div>
            <div className="text-xs mt-0.5 uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
              en pistas
            </div>
          </div>

          <div className="text-center">
            <div className="text-xl font-bold font-mono" style={{ color: "var(--primary)" }}>
              Top {percentile}%
            </div>
            <div className="text-xs mt-0.5 uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
              percentil
            </div>
          </div>

          <div className="text-center">
            {profile.rank <= 3 ? (
              <>
                <div className="text-xl font-bold font-mono" style={{ color: "#d97706" }}>Top 3</div>
                <div className="text-xs mt-0.5 uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
                  en el podio
                </div>
              </>
            ) : profile.top3_score !== null ? (
              <>
                <div className="text-xl font-bold font-mono" style={{ color: "var(--text)" }}>
                  {(profile.top3_score - profile.score).toLocaleString()}
                </div>
                <div className="text-xs mt-0.5 uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
                  pts al top 3
                </div>
              </>
            ) : (
              <>
                <div className="text-xl font-bold font-mono" style={{ color: "var(--text-faint)" }}>—</div>
                <div className="text-xs mt-0.5 uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
                  pts al top 3
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Insignias ──────────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Insignias
          </h2>
          <span className="text-xs font-mono font-bold" style={{ color: "var(--primary)" }}>
            {earnedCount} / {badges.length}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {badges.map(badge => (
            <div
              key={badge.id}
              className="rounded-lg p-3 text-center transition-all"
              style={{
                background: badge.earned ? "var(--primary-light)" : "var(--surface-alt)",
                border: `1px solid ${badge.earned ? "var(--primary-border)" : "var(--border-subtle)"}`,
                opacity: badge.earned ? 1 : 0.45,
              }}
            >
              <div className="flex justify-center mb-1.5" style={{ color: badge.earned ? "var(--primary)" : "var(--text-muted)" }}>{badge.icon}</div>
              <div
                className="text-xs font-semibold leading-tight"
                style={{ color: badge.earned ? "var(--primary)" : "var(--text-muted)" }}
              >
                {badge.name}
              </div>
              <div className="text-xs mt-1 leading-tight" style={{ color: "var(--text-faint)" }}>
                {badge.description}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Solves ─────────────────────────────────────────────────────── */}
      <div className="card">
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
          Retos resueltos ({profile.solves.length})
        </h2>
        {profile.solves.length === 0 ? (
          <div className="text-center py-8">
            <p style={{ color: "var(--text-faint)" }}>Aún no has resuelto ningún reto.</p>
            <a href="/challenges" className="btn-primary inline-flex mt-4 text-sm">Ver retos</a>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {profile.solves.map(s => {
              const usedHints = profile.hints_used_slugs.includes(s.challenge_slug);
              return (
                <li key={s.challenge_slug} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={`/challenges/${s.challenge_slug}`}
                        className="font-medium hover:underline"
                        style={{ color: "var(--text)" }}
                      >
                        {s.challenge_name}
                      </a>
                      {!usedHints && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{
                            background: "var(--success-bg)",
                            color: "var(--success)",
                            border: "1px solid var(--success-border)",
                          }}
                        >
                          sin pistas
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
                      {new Date(s.solved_at).toLocaleString("es-ES")}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-sm shrink-0" style={{ color: "var(--primary)" }}>
                    +{s.points}pt
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
