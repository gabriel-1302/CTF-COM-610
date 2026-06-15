import { useEffect, useState, useCallback, useRef } from "react";

interface Props {
  expiresAt: string;
  onExpire?: () => void;
}

export default function CountdownTimer({ expiresAt, onExpire }: Props) {
  const target = useRef(new Date(expiresAt).getTime());
  const [remaining, setRemaining] = useState(() => target.current - Date.now());
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    target.current = new Date(expiresAt).getTime();
    setRemaining(target.current - Date.now());
  }, [expiresAt]);

  useEffect(() => {
    const tick = () => {
      const r = target.current - Date.now();
      setRemaining(r);
      if (r <= 0 && onExpireRef.current) {
        onExpireRef.current();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (remaining <= 0) {
    return (
      <div role="status" aria-live="polite" className="text-red-400 text-sm font-mono">
        ⏱ Instancia expirada
      </div>
    );
  }

  const totalSec = Math.floor(remaining / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const warn = totalSec < 300; // menos de 5min → ámbar

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500">Expira en</span>
      <span
        role="timer"
        aria-label={`${min} minutos ${sec} segundos restantes`}
        aria-live="off"
        className={`text-xl font-mono tabular-nums font-bold transition-colors ${
          warn ? "text-amber-400" : "text-emerald-400"
        }`}
      >
        {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
      </span>
    </div>
  );
}
