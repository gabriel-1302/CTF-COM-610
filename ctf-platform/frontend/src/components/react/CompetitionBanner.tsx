import { useEffect, useState } from "react";
import { fetchCompetitionConfig } from "../../lib/api";
import type { CompetitionConfig } from "../../lib/schemas";
import { IconClock, IconExclamationTriangle } from "./icons";

type Status = "loading" | "open" | "pending" | "active" | "ended";

function getStatus(cfg: CompetitionConfig, now: Date): Status {
  const start = cfg.start_time ? new Date(cfg.start_time) : null;
  const end = cfg.end_time ? new Date(cfg.end_time) : null;
  if (!start && !end) return "open";
  if (start && now < start) return "pending";
  if (end && now > end) return "ended";
  return "active";
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
    weekday: "long", day: "2-digit", month: "long",
    hour: "2-digit", minute: "2-digit",
  });
}

function IconHourglass({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2h12M6 22h12M6 2v5l6 5-6 5v2M18 2v5l-6 5 6 5v2" />
    </svg>
  );
}

function IconFlagFinish({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />
    </svg>
  );
}

export default function CompetitionBanner() {
  const [cfg, setCfg] = useState<CompetitionConfig | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchCompetitionConfig().then(setCfg).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!cfg) return null;

  const status = getStatus(cfg, now);
  if (status === "open") return null;

  if (status === "pending") {
    const ms = new Date(cfg.start_time!).getTime() - now.getTime();
    return (
      <div
        className="flex items-center gap-4 px-5 py-4 rounded-xl mb-6 text-sm"
        style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
          border: "1px solid #4338ca",
          color: "#fff",
        }}
      >
        <IconHourglass className="w-7 h-7 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base">La competencia aún no ha comenzado</p>
          <p className="text-sm opacity-80 mt-0.5">{formatDate(cfg.start_time!)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs opacity-60 mb-0.5">Comienza en</p>
          <p className="font-mono font-bold text-xl tabular-nums" style={{ color: "#a5b4fc" }}>
            {formatCountdown(ms)}
          </p>
        </div>
      </div>
    );
  }

  if (status === "active" && cfg.end_time) {
    const ms = new Date(cfg.end_time).getTime() - now.getTime();
    const urgent = ms < 30 * 60 * 1000;
    return (
      <div
        className="flex items-center gap-4 px-5 py-4 rounded-xl mb-6 text-sm"
        style={{
          background: urgent
            ? "linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)"
            : "linear-gradient(135deg, #052e16 0%, #14532d 100%)",
          border: `1px solid ${urgent ? "#ef4444" : "#16a34a"}`,
          color: "#fff",
        }}
      >
        {urgent
          ? <IconExclamationTriangle className="w-7 h-7 shrink-0" style={{ color: "#fca5a5" }} />
          : <IconClock className="w-7 h-7 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base">Competencia en curso</p>
          <p className="text-sm opacity-80 mt-0.5">Finaliza el {formatDate(cfg.end_time)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs opacity-60 mb-0.5">Tiempo restante</p>
          <p
            className="font-mono font-bold text-xl tabular-nums"
            style={{ color: urgent ? "#fca5a5" : "#86efac" }}
          >
            {formatCountdown(ms)}
          </p>
        </div>
      </div>
    );
  }

  if (status === "ended") {
    return (
      <div
        className="flex items-center gap-3 px-5 py-4 rounded-xl mb-6 text-sm"
        style={{
          background: "var(--surface-alt)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)",
        }}
      >
        <IconFlagFinish className="w-6 h-6 shrink-0" />
        <div>
          <p className="font-bold" style={{ color: "var(--text)" }}>La competencia ha finalizado</p>
          {cfg.end_time && (
            <p className="text-xs opacity-70 mt-0.5">Terminó el {formatDate(cfg.end_time)}</p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
