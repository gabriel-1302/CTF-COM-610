import type { Challenge } from "../../lib/schemas";
import { IconDroplet } from "./icons";

interface Props {
  challenge: Challenge;
}

const categoryConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  sqli:             { label: "Inyección SQL",        bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
  xss:              { label: "XSS almacenado",       bg: "#ede9fe", text: "#3730a3", border: "#c4b5fd" },
  ssti:             { label: "Inyec. de plantillas",  bg: "#ecfeff", text: "#155e75", border: "#a5f3fc" },
  "crypto-rsa":     { label: "Criptografía RSA",     bg: "#fff1f2", text: "#9f1239", border: "#fecdd3" },
  "crypto-vigenere":{ label: "Criptografía clásica", bg: "#f5f3ff", text: "#5b21b6", border: "#ddd6fe" },
  cmdi:             { label: "Command Injection",    bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
  "path-traversal": { label: "Path Traversal",       bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
  jwt:              { label: "JWT",                   bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
};

export default function ChallengeCard({ challenge }: Props) {
  const solved = challenge.is_solved;
  const cfg = categoryConfig[challenge.slug] ?? {
    label: challenge.slug.toUpperCase(),
    bg: "#f5f3ff", text: "#503AA8", border: "#c3b9f4",
  };

  const isDynamic = challenge.is_dynamic ?? false;
  const displayPoints = challenge.current_points ?? challenge.points;
  const initialPoints = challenge.points;
  const decayPct = isDynamic && initialPoints > 0
    ? Math.round((displayPoints / initialPoints) * 100)
    : 100;
  const hasDecayed = isDynamic && displayPoints < initialPoints;

  return (
    <a
      href={`/challenges/${challenge.slug}`}
      className="group block rounded-lg border transition-all duration-150 card-hover"
      style={{
        background: solved ? "var(--success-bg)" : "var(--surface)",
        borderColor: solved ? "var(--success-border)" : "var(--border)",
      }}
      aria-label={`${challenge.name}, ${displayPoints} puntos${solved ? ", resuelto" : ""}`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <span
            className="inline-block text-xs font-semibold px-2.5 py-1 rounded"
            style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
          >
            {cfg.label}
          </span>

          <div className="text-right shrink-0">
            <span className="text-xs font-mono font-bold" style={{ color: "var(--primary)" }}>
              {displayPoints} pt
            </span>
            {hasDecayed && (
              <div className="text-xs line-through" style={{ color: "var(--text-faint)" }}>
                {initialPoints} pt
              </div>
            )}
          </div>
        </div>

        <h3 className="text-sm font-bold mb-1.5" style={{ color: "var(--text)" }}>
          {challenge.name}
        </h3>
        <p className="text-xs line-clamp-2 mb-4" style={{ color: "var(--text-muted)" }}>
          {challenge.description}
        </p>

        {isDynamic && (
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                {challenge.solve_count ?? 0} {(challenge.solve_count ?? 0) === 1 ? "solve" : "solves"}
              </span>
              <span className="text-xs font-medium" style={{ color: decayPct < 40 ? "var(--error)" : decayPct < 70 ? "#D97706" : "var(--success)" }}>
                {decayPct}% valor
              </span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${decayPct}%`,
                  background: decayPct < 40 ? "var(--usfx-red)" : decayPct < 70 ? "#D97706" : "var(--primary)",
                }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {solved ? (
              <span className="badge-solved">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Resuelto
              </span>
            ) : (
              <span className="text-xs font-medium" style={{ color: "var(--text-faint)" }}>
                Sin resolver
              </span>
            )}
            {challenge.first_blood_username && (
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded"
                style={{ background: "var(--error-bg)", color: "#9f1239", border: "1px solid var(--error-border)" }}
                title={`First blood: ${challenge.first_blood_username}`}
              >
                <IconDroplet className="w-3 h-3" style={{ color: "#be123c" }} />
                {challenge.first_blood_username}
              </span>
            )}
          </div>
          <svg
            className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5"
            fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
            style={{ color: "var(--text-faint)" }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </a>
  );
}
