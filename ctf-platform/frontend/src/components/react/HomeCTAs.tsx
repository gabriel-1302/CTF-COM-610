import { useStore } from "@nanostores/react";
import { registrationOpen } from "../../lib/auth";

export default function HomeCTAs() {
  const canRegister = useStore(registrationOpen);

  return (
    <div className="flex flex-wrap gap-3 animate-slide-up" style={{ animationDelay: "240ms" }}>
      {canRegister !== false && (
        <a href="/register" className="hero-cta-gold">
          Participar
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      )}
      <a href="/scoreboard" className="hero-cta-outline">
        Ver clasificación
      </a>
    </div>
  );
}
