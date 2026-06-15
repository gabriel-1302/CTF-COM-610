import { useEffect, useState } from "react";
import { submitFlag } from "../../lib/api";
import { showToast } from "../../lib/toast";
import type { CompetitionConfig } from "../../lib/schemas";
import { IconFlag, IconLockClosed, IconCheck, IconX } from "./icons";

interface Props {
  slug: string;
  disabled: boolean;
  onSolved: () => void;
  competitionCfg?: CompetitionConfig | null;
}

function getCompetitionBlock(cfg: CompetitionConfig | null | undefined): string | null {
  if (!cfg) return null;
  const now = new Date();
  if (cfg.start_time && now < new Date(cfg.start_time)) return "La competencia aún no ha comenzado.";
  if (cfg.end_time && now > new Date(cfg.end_time)) return "La competencia ha finalizado.";
  return null;
}

export default function FlagSubmit({ slug, disabled, onSolved, competitionCfg }: Props) {
  const [flag, setFlag] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const competitionBlock = getCompetitionBlock(competitionCfg);
  const isBlocked = !disabled && !!competitionBlock;

  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(id);
  }, [feedback]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await submitFlag(slug, flag.trim());
      const msg = res.message ?? res.detail ?? (res.correct ? "¡Correcto!" : "Flag incorrecta.");
      if (res.correct) {
        setFeedback({ ok: true, msg });
        setFlag("");
        showToast("success", `Flag correcta. +${res.points_earned ?? "?"} pts`);
        onSolved();
      } else {
        setFeedback({ ok: false, msg });
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail ?? e?.response?.data?.message;
      if (status === 429) {
        setFeedback({ ok: false, msg: "Demasiados intentos. Espera un momento." });
      } else if (status === 400) {
        setFeedback({ ok: false, msg: detail ?? "Flag incorrecta o ya resuelta." });
      } else if (status === 409) {
        setFeedback({ ok: false, msg: detail ?? "Ya resolviste este challenge." });
      } else {
        setFeedback({ ok: false, msg: detail ?? "Error al enviar la flag." });
      }
    } finally {
      setLoading(false);
    }
  }

  if (disabled) {
    return (
      <div
        className="rounded-xl px-4 py-5 flex items-center gap-4"
        style={{
          background: "linear-gradient(135deg, #052e16 0%, #14532d 100%)",
          border: "1px solid rgba(74,222,128,0.3)",
        }}
      >
        <span
          className="inline-flex items-center justify-center w-10 h-10 rounded-full shrink-0"
          style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)" }}
        >
          <IconCheck className="w-5 h-5" strokeWidth={2.5} style={{ color: "#4ade80" }} />
        </span>
        <div>
          <p className="font-bold text-sm" style={{ color: "#4ade80" }}>¡Challenge resuelto!</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>La flag fue enviada correctamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="font-bold mb-4 flex items-center gap-2 text-sm" style={{ color: "var(--text)" }}>
        <IconFlag className="w-4 h-4" style={{ color: "var(--primary)" }} />
        Enviar flag
      </h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="flag-input" className="block text-xs mb-1.5 font-mono" style={{ color: "var(--text-faint)" }}>
            Formato: CTF&#123;...&#125;
          </label>
          <input
            id="flag-input"
            type="text"
            placeholder="CTF{...}"
            className="input-field font-mono text-sm"
            value={flag}
            onChange={(e) => setFlag(e.target.value)}
            disabled={isBlocked || loading}
            required
            minLength={5}
            aria-label="Flag del challenge"
            aria-describedby={feedback ? "flag-feedback" : undefined}
          />
        </div>
        {isBlocked ? (
          <div
            className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-lg border"
            style={{ color: "var(--text-muted)", background: "var(--surface-alt)", borderColor: "var(--border)" }}
          >
            <IconLockClosed className="w-4 h-4 shrink-0" />
            {competitionBlock}
          </div>
        ) : (
          <button
            type="submit"
            disabled={loading || !flag.trim()}
            className="btn-primary"
            aria-label="Enviar flag"
          >
            {loading ? "Enviando..." : "Enviar flag"}
          </button>
        )}
      </form>
      {feedback && (
        <div
          id="flag-feedback"
          role="alert"
          aria-live="polite"
          className="mt-3 flex items-start gap-2 text-sm px-3 py-2.5 rounded-lg border animate-slide-down"
          style={feedback.ok
            ? { color: "var(--success)", background: "var(--success-bg)", borderColor: "var(--success-border)" }
            : { color: "var(--error)", background: "var(--error-bg)", borderColor: "var(--error-border)" }
          }
        >
          {feedback.ok
            ? <IconCheck className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2.5} />
            : <IconX className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2.5} />
          }
          {feedback.msg}
        </div>
      )}
    </div>
  );
}
