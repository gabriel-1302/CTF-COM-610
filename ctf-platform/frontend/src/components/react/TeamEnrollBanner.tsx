import { useEffect, useState } from "react";
import { fetchMyTeam, fetchRegistrationStatus, fetchCompetitionConfig } from "../../lib/api";
import type { RegistrationStatus } from "../../lib/schemas";
import { IconBan, IconTrophy, IconArrowRight } from "./icons";

export default function TeamEnrollBanner() {
  const [status, setStatus] = useState<"loading" | "show" | "hide">("loading");
  const [regStatus, setRegStatus] = useState<RegistrationStatus | null>(null);

  useEffect(() => {
    Promise.all([fetchMyTeam(), fetchRegistrationStatus(), fetchCompetitionConfig()])
      .then(([team, reg, cfg]) => {
        const now = new Date();
        const ended = cfg.end_time ? now > new Date(cfg.end_time) : false;
        const needsTeam = reg.competition_mode === "teams" || reg.competition_mode === "mixed";
        if (!team && needsTeam && reg.registration_open && reg.competition_active && !ended) {
          setRegStatus(reg);
          setStatus("show");
        } else {
          setStatus("hide");
        }
      })
      .catch(() => setStatus("hide"));
  }, []);

  if (status !== "show" || !regStatus) return null;

  const slotsLeft = regStatus.teams_remaining;
  const noSlots = slotsLeft !== null && slotsLeft === 0;

  return (
    <div
      className="flex items-center gap-4 px-5 py-4 rounded-xl mb-6"
      style={{
        background: noSlots
          ? "linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)"
          : "linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)",
        border: `1px solid ${noSlots ? "#ef4444" : "#6366f1"}`,
        color: "#fff",
      }}
    >
      <span className="shrink-0">{noSlots ? <IconBan className="w-6 h-6" /> : <IconTrophy className="w-6 h-6" />}</span>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-base">
          {noSlots ? "Sin cupos disponibles" : "¡Inscríbete a la competencia!"}
        </p>
        <p className="text-sm mt-0.5 opacity-80">
          {noSlots
            ? "Los cupos de equipo se han agotado. Contacta al administrador."
            : regStatus.competition_mode === "mixed"
            ? "Puedes competir de forma individual o en equipo."
            : slotsLeft !== null
            ? `Quedan ${slotsLeft} de ${regStatus.max_teams} cupos — crea tu equipo o únete con un código.`
            : "Crea tu equipo o únete con el código de un compañero."}
        </p>
      </div>

      {!noSlots && (
        <a
          href="/team"
          className="shrink-0 px-4 py-2 rounded-lg font-bold text-sm transition-all hover:opacity-90 active:scale-95"
          style={{ background: "#fff", color: "#4338ca" }}
        >
          Inscribirme <IconArrowRight className="w-4 h-4 inline" />
        </a>
      )}
    </div>
  );
}
