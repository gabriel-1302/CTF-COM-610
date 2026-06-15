import { useState } from "react";
import { spawnInstance, killInstance } from "../../lib/api";
import { showToast } from "../../lib/toast";
import CountdownTimer from "./CountdownTimer";
import ConfirmDialog from "./ConfirmDialog";
import { IconSpinner, IconPlay, IconStop } from "./icons";

interface ActiveInstance {
  id: number;
  host_port: number;
  expires_at: string;
  url?: string;
}

interface Props {
  slug: string;
  instance: ActiveInstance | null;
  onChange: () => Promise<void>;
}

export default function InstancePanel({ slug, instance, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [killOpen, setKillOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSpawn() {
    setLoading(true);
    setError(null);
    try {
      await spawnInstance(slug);
      await onChange();
      showToast("success", "Instancia iniciada correctamente");
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.response?.data?.non_field_errors?.[0];
      const status = e?.response?.status;
      const msg =
        status === 409
          ? "Ya tienes una instancia activa para este challenge"
          : status === 429
          ? "Demasiadas instancias activas. Destruye alguna primero."
          : detail ?? "Error al iniciar instancia";
      setError(msg);
      showToast("error", msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleKill() {
    if (!instance) return;
    setLoading(true);
    setError(null);
    try {
      await killInstance(instance.id);
      await onChange();
      showToast("success", "Instancia destruida");
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? "Error al destruir instancia";
      setError(msg);
      showToast("error", msg);
    } finally {
      setLoading(false);
    }
  }

  if (!instance) {
    return (
      <div className="card">
        <div className="flex items-center gap-2.5 mb-3">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: "var(--text-faint)" }}
            aria-hidden="true"
          />
          <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>Entorno de ataque</h3>
        </div>
        <p className="text-xs mb-4 leading-relaxed" style={{ color: "var(--text-faint)" }}>
          Lanza un contenedor Docker aislado para explotar el reto. Se destruye automáticamente a los 30 min.
        </p>
        <button
          onClick={handleSpawn}
          disabled={loading}
          className="btn-primary w-full"
          aria-label="Iniciar instancia del challenge"
        >
          {loading ? (
            <>
              <IconSpinner className="w-4 h-4" />
              Iniciando...
            </>
          ) : (
            <>
              <IconPlay className="w-4 h-4" />
              Iniciar instancia
            </>
          )}
        </button>
        {error && (
          <p role="alert" className="text-xs mt-2.5" style={{ color: "var(--error)" }}>{error}</p>
        )}
      </div>
    );
  }

  const url = instance.url || `http://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:${instance.host_port}`;

  return (
    <div
      className="card overflow-hidden"
      style={{ borderColor: "var(--success-border)", background: "var(--success-bg)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: "var(--success)" }}>
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: "var(--success)" }}
            />
            <span
              className="relative inline-flex rounded-full h-2.5 w-2.5"
              style={{ background: "var(--success)" }}
            />
          </span>
          Instancia activa
        </h3>
        <CountdownTimer expiresAt={instance.expires_at} onExpire={onChange} />
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between font-mono text-xs px-3 py-2.5 rounded-lg mb-4 transition-opacity hover:opacity-80"
        style={{
          color: "var(--success)",
          background: "var(--surface)",
          border: "1px solid var(--success-border)",
        }}
        aria-label={`Abrir instancia en ${url}`}
      >
        <span className="break-all">{url}</span>
        <span className="ml-2 shrink-0">↗</span>
      </a>

      <button
        onClick={() => setKillOpen(true)}
        disabled={loading}
        className="btn-danger w-full text-sm"
        aria-label="Destruir instancia activa"
      >
        {loading ? (
          <>
            <IconSpinner className="w-4 h-4" />
            Destruyendo...
          </>
        ) : (
          <>
            <IconStop className="w-4 h-4" />
            Destruir instancia
          </>
        )}
      </button>

      {error && (
        <p role="alert" className="text-xs mt-2.5" style={{ color: "var(--error)" }}>{error}</p>
      )}

      {killOpen && (
        <ConfirmDialog
          title="¿Destruir instancia?"
          description="El entorno se eliminará de inmediato y perderás el acceso. Esta acción no se puede deshacer."
          confirmLabel="Destruir"
          cancelLabel="Cancelar"
          danger
          onConfirm={handleKill}
          onClose={() => setKillOpen(false)}
        />
      )}
    </div>
  );
}
