import { useEffect, useState } from "react";
import { fetchCompetitionConfig } from "../../lib/api";
import type { CompetitionConfig } from "../../lib/schemas";
import { IconTrophy, IconArrowRight } from "./icons";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

export default function CompetitionEntryBanner() {
  const [cfg, setCfg] = useState<CompetitionConfig | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchCompetitionConfig().then(setCfg).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!cfg || !cfg.competition_mode) return null;

  const start = cfg.start_time ? new Date(cfg.start_time) : null;
  const end = cfg.end_time ? new Date(cfg.end_time) : null;
  const ended = end && now > end;
  const pending = start && now < start;
  const msLeft = end ? end.getTime() - now.getTime() : null;
  const msToStart = start ? start.getTime() - now.getTime() : null;

  if (ended) return null;

  return (
    <div
      className="flex items-center gap-4 px-5 py-4 rounded-xl mb-6"
      style={{
        background: "linear-gradient(135deg, #312e81 0%, #1e3a5f 100%)",
        border: "1px solid #6366f1",
        color: "#fff",
      }}
    >
      <IconTrophy className="w-6 h-6 shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="font-bold text-base truncate">{cfg.name}</p>
        <p className="text-sm opacity-75 mt-0.5">
          {pending && msToStart !== null
            ? `Comienza en ${formatCountdown(msToStart)}`
            : msLeft !== null
            ? `Tiempo restante: ${formatCountdown(msLeft)}`
            : "Competencia activa"}
          {cfg.challenge_slugs.length > 0 && ` · ${cfg.challenge_slugs.length} retos`}
        </p>
      </div>

      <a
        href="/competencia"
        className="shrink-0 px-4 py-2 rounded-lg font-bold text-sm transition-all hover:opacity-90 active:scale-95 whitespace-nowrap"
        style={{ background: "#6366f1", color: "#fff", border: "1px solid #818cf8" }}
      >
        {pending ? <>Ver competencia <IconArrowRight className="w-4 h-4 inline" /></> : <>Entrar <IconArrowRight className="w-4 h-4 inline" /></>}
      </a>
    </div>
  );
}
