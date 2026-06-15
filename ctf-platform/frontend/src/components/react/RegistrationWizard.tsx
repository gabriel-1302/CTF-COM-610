import { useState, useEffect, useRef } from "react";
import {
  fetchRegistrationStatus,
  register,
  login,
  fetchMe,
  createTeam,
  joinTeam,
  previewTeamByCode,
} from "../../lib/api";
import { setAuth } from "../../lib/auth";
import { showToast } from "../../lib/toast";
import type { RegistrationStatus } from "../../lib/schemas";
import {
  IconCheck, IconArrowLeft, IconArrowRight,
  IconLockClosed, IconCircleCheck, IconBan, IconTrophy, IconBolt, IconLink,
} from "./icons";

// ─── Íconos inline ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function StepBar({ step, total, labels }: { step: number; total: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={i} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300"
                style={{
                  background: done
                    ? "var(--success, #22c55e)"
                    : active
                    ? "var(--primary)"
                    : "var(--surface-elevated)",
                  color: done || active ? "#fff" : "var(--text-muted)",
                  border: active ? "2px solid var(--primary)" : "2px solid transparent",
                }}
              >
                {done ? <IconCheck className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className="text-xs font-medium whitespace-nowrap"
                style={{ color: active ? "var(--primary)" : done ? "var(--success, #22c55e)" : "var(--text-muted)" }}
              >
                {labels[i]}
              </span>
            </div>
            {i < total - 1 && (
              <div
                className="flex-1 h-0.5 mx-1 mb-5 transition-all duration-300"
                style={{ background: done ? "var(--success, #22c55e)" : "var(--border)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CompetitionBadge({ status }: { status: RegistrationStatus }) {
  const needsTeam = status.competition_mode !== "individual";
  return (
    <div
      className="rounded-xl p-4 mb-6 border"
      style={{ background: "var(--surface-elevated)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-base truncate" style={{ color: "var(--text)" }}>
            {status.competition_name}
          </p>
          {status.competition_description && (
            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>
              {status.competition_description}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {needsTeam && status.max_teams !== null && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background:
                    (status.teams_remaining ?? 0) === 0
                      ? "var(--error-bg)"
                      : "var(--primary-subtle, rgba(99,102,241,0.12))",
                  color:
                    (status.teams_remaining ?? 0) === 0 ? "var(--error)" : "var(--primary)",
                }}
              >
                {status.teams_remaining === 0
                  ? "Sin cupos de equipo"
                  : `${status.teams_remaining} cupos de equipo disponibles`}
              </span>
            )}
            {needsTeam && status.max_teams === null && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: "var(--primary-subtle, rgba(99,102,241,0.12))", color: "var(--primary)" }}
              >
                Equipos ilimitados
              </span>
            )}
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
            >
              {status.competition_mode === "individual"
                ? "Modalidad individual"
                : status.competition_mode === "teams"
                ? "Modalidad equipos"
                : "Modalidad mixta"}
            </span>
          </div>
        </div>
        <div
          className="shrink-0 w-2.5 h-2.5 rounded-full mt-1"
          style={{ background: status.registration_open ? "var(--success, #22c55e)" : "var(--error)" }}
          title={status.registration_open ? "Registro abierto" : "Registro cerrado"}
        />
      </div>
    </div>
  );
}

// ─── Paso 1: Crear cuenta ─────────────────────────────────────────────────────

function Step1Account({
  status,
  onSuccess,
}: {
  status: RegistrationStatus;
  onSuccess: (username: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usernameOk = username.length >= 3 && username.length <= 30;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordOk = password.length >= 8;
  const confirmOk = password === confirm && confirm.length > 0;

  function parseError(err: any): string {
    const detail = err?.response?.data;
    if (!detail) return "Sin conexión con el servidor";
    if (typeof detail === "string") return detail;
    if (typeof detail === "object") {
      return Object.entries(detail)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
        .join(" · ");
    }
    return "Error al crear la cuenta";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmOk) { setError("Las contraseñas no coinciden"); return; }
    setError(null);
    setLoading(true);
    try {
      await register(username, email, password);
      const { access } = await login(username, password);
      setAuth(access, username);
      fetchMe().catch(() => {});
      showToast("success", `¡Cuenta creada, ${username}!`);
      onSuccess(username);
    } catch (err: any) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  }

  function fieldStatus(ok: boolean, value: string) {
    if (!value) return {};
    return { color: ok ? "var(--success, #22c55e)" : "var(--error)" };
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <CompetitionBadge status={status} />

      <div>
        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>
          Usuario
          <span className="ml-2 text-xs font-normal" style={fieldStatus(usernameOk, username)}>
            {username && (usernameOk ? <IconCheck className="w-3.5 h-3.5 inline" /> : "3-30 caracteres")}
          </span>
        </label>
        <input
          type="text"
          autoComplete="username"
          className="input-field"
          placeholder="nombre_usuario"
          required
          minLength={3}
          maxLength={30}
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>
          Correo electrónico
          <span className="ml-2 text-xs font-normal" style={fieldStatus(emailOk, email)}>
            {email && (emailOk ? <IconCheck className="w-3.5 h-3.5 inline" /> : "formato inválido")}
          </span>
        </label>
        <input
          type="email"
          autoComplete="email"
          className="input-field"
          placeholder="correo@usfx.bo"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>
          Contraseña
          <span className="ml-2 text-xs font-normal" style={fieldStatus(passwordOk, password)}>
            {password && (passwordOk ? <IconCheck className="w-3.5 h-3.5 inline" /> : "mínimo 8 caracteres")}
          </span>
        </label>
        <input
          type="password"
          autoComplete="new-password"
          className="input-field"
          placeholder="mínimo 8 caracteres"
          required
          minLength={8}
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>
          Confirmar contraseña
          <span className="ml-2 text-xs font-normal" style={fieldStatus(confirmOk, confirm)}>
            {confirm && (confirmOk ? <IconCheck className="w-3.5 h-3.5 inline" /> : "no coincide")}
          </span>
        </label>
        <input
          type="password"
          autoComplete="new-password"
          className="input-field"
          placeholder="repite tu contraseña"
          required
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="text-sm px-3 py-2.5 rounded-md"
          style={{ background: "var(--error-bg)", color: "var(--error)", border: "1px solid var(--error-border)" }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !usernameOk || !emailOk || !passwordOk || !confirmOk}
        className="btn-primary w-full mt-1"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner /> Creando cuenta...
          </span>
        ) : <>Crear cuenta y continuar <IconArrowRight className="w-4 h-4 inline ml-1" /></>}
      </button>

      <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
        ¿Ya tienes cuenta?{" "}
        <a href="/login" className="font-semibold underline underline-offset-2" style={{ color: "var(--primary)" }}>
          Iniciar sesión
        </a>
      </p>
    </form>
  );
}

// ─── Paso 2: Equipo ───────────────────────────────────────────────────────────

function Step2Team({
  status,
  onSuccess,
  onSkip,
}: {
  status: RegistrationStatus;
  onSuccess: () => void;
  onSkip: () => void;
}) {
  const [subStep, setSubStep] = useState<"choice" | "create" | "join">("choice");
  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [teamPreview, setTeamPreview] = useState<{ name: string; member_count: number; max_members: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lookupTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const noTeamSlots = status.max_teams !== null && (status.teams_remaining ?? 0) === 0;

  function parseError(err: any): string {
    const detail = err?.response?.data?.detail ?? err?.response?.data;
    if (!detail) return "Error inesperado";
    if (typeof detail === "string") return detail;
    return JSON.stringify(detail);
  }

  // Lookup en tiempo real al escribir el código
  useEffect(() => {
    if (joinCode.length !== 8) { setTeamPreview(null); return; }
    if (lookupTimeout.current) clearTimeout(lookupTimeout.current);
    lookupTimeout.current = setTimeout(async () => {
      setPreviewLoading(true);
      const preview = await previewTeamByCode(joinCode);
      setTeamPreview(preview);
      setPreviewLoading(false);
    }, 400);
    return () => { if (lookupTimeout.current) clearTimeout(lookupTimeout.current); };
  }, [joinCode]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createTeam(teamName.trim());
      showToast("success", `¡Equipo "${teamName.trim()}" creado!`);
      onSuccess();
    } catch (err: any) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const team = await joinTeam(joinCode.toUpperCase());
      showToast("success", `¡Te uniste a "${team.name}"!`);
      onSuccess();
    } catch (err: any) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  }

  if (subStep === "choice") {
    return (
      <div className="flex flex-col gap-4">
        <CompetitionBadge status={status} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          La competencia es por equipos. Crea el tuyo o únete con el código de un compañero.
        </p>

        <button
          onClick={() => { setSubStep("create"); setError(null); }}
          disabled={noTeamSlots}
          className="flex items-center gap-4 p-4 rounded-xl border text-left transition-all hover:border-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "var(--surface-elevated)", borderColor: "var(--border)" }}
        >
          <IconBolt className="w-6 h-6 shrink-0" style={{ color: "var(--primary)" }} />
          <div>
            <p className="font-bold" style={{ color: "var(--text)" }}>Crear equipo</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {noTeamSlots
                ? "No hay cupos disponibles"
                : status.max_teams !== null
                ? `${status.teams_remaining} de ${status.max_teams} cupos disponibles`
                : "Cupos ilimitados"}
            </p>
          </div>
        </button>

        <button
          onClick={() => { setSubStep("join"); setError(null); }}
          className="flex items-center gap-4 p-4 rounded-xl border text-left transition-all hover:border-[var(--primary)]"
          style={{ background: "var(--surface-elevated)", borderColor: "var(--border)" }}
        >
          <IconLink className="w-6 h-6 shrink-0" style={{ color: "var(--primary)" }} />
          <div>
            <p className="font-bold" style={{ color: "var(--text)" }}>Unirme a un equipo</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Ingresa el código de 8 caracteres de tu capitán
            </p>
          </div>
        </button>

        {status.competition_mode === "mixed" && (
          <button
            onClick={onSkip}
            className="text-sm text-center underline underline-offset-2"
            style={{ color: "var(--text-muted)" }}
          >
            Continuar sin equipo (modo individual)
          </button>
        )}
      </div>
    );
  }

  if (subStep === "create") {
    return (
      <form onSubmit={handleCreate} className="flex flex-col gap-4" noValidate>
        <button
          type="button"
          onClick={() => { setSubStep("choice"); setError(null); }}
          className="flex items-center gap-1.5 text-sm mb-2 -ml-1"
          style={{ color: "var(--text-muted)" }}
        >
          <IconArrowLeft className="w-4 h-4 inline" /> Volver
        </button>

        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>
            Nombre del equipo
          </label>
          <input
            type="text"
            className="input-field"
            placeholder="ej: Equipo Alpha"
            required
            minLength={3}
            maxLength={64}
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
          />
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            3-64 caracteres · único en la competencia
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="text-sm px-3 py-2.5 rounded-md"
            style={{ background: "var(--error-bg)", color: "var(--error)", border: "1px solid var(--error-border)" }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || teamName.trim().length < 3}
          className="btn-primary w-full"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner /> Creando equipo...
            </span>
          ) : <>Crear equipo <IconArrowRight className="w-4 h-4 inline ml-1" /></>}
        </button>
      </form>
    );
  }

  // subStep === "join"
  return (
    <form onSubmit={handleJoin} className="flex flex-col gap-4" noValidate>
      <button
        type="button"
        onClick={() => { setSubStep("choice"); setError(null); }}
        className="flex items-center gap-1.5 text-sm mb-2 -ml-1"
        style={{ color: "var(--text-muted)" }}
      >
        <IconArrowLeft className="w-4 h-4 inline" /> Volver
      </button>

      <div>
        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>
          Código de invitación
        </label>
        <input
          type="text"
          className="input-field font-mono tracking-widest uppercase"
          placeholder="XXXXXXXX"
          required
          minLength={8}
          maxLength={8}
          value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
        />

        {/* Preview del equipo */}
        {joinCode.length === 8 && (
          <div className="mt-2">
            {previewLoading ? (
              <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                <Spinner /> Buscando equipo...
              </p>
            ) : teamPreview ? (
              <div
                className="flex items-center justify-between px-3 py-2 rounded-lg border"
                style={{ background: "var(--surface-elevated)", borderColor: "var(--success, #22c55e)" }}
              >
                <div>
                  <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{teamPreview.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {teamPreview.member_count}/{teamPreview.max_members} miembros
                  </p>
                </div>
                <IconCheck className="w-4 h-4" style={{ color: "var(--success, #22c55e)" }} />
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--error)" }}>Código no encontrado</p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="text-sm px-3 py-2.5 rounded-md"
          style={{ background: "var(--error-bg)", color: "var(--error)", border: "1px solid var(--error-border)" }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || joinCode.length !== 8 || !teamPreview}
        className="btn-primary w-full"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner /> Uniéndome...
          </span>
        ) : <>Unirme al equipo <IconArrowRight className="w-4 h-4 inline ml-1" /></>}
      </button>
    </form>
  );
}

// ─── Paso 3: Éxito ────────────────────────────────────────────────────────────

function Step3Success({ username }: { username: string }) {
  useEffect(() => {
    const t = setTimeout(() => { location.href = "/challenges"; }, 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "var(--success-bg, rgba(34,197,94,0.12))" }}
      >
        <IconCircleCheck className="w-8 h-8" style={{ color: "var(--success, #22c55e)" }} />
      </div>
      <div>
        <p className="text-lg font-bold" style={{ color: "var(--text)" }}>
          ¡Listo, {username}!
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Tu inscripción está completa. Redirigiendo a los retos...
        </p>
      </div>
      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        <div
          className="h-full rounded-full"
          style={{
            background: "var(--primary)",
            animation: "grow 2.5s linear forwards",
          }}
        />
      </div>
      <a href="/challenges" className="btn-primary w-full inline-flex items-center justify-center gap-1">
        Ir a los retos ahora <IconArrowRight className="w-4 h-4 inline ml-1" />
      </a>
      <style>{`@keyframes grow { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}

// ─── Wizard principal ─────────────────────────────────────────────────────────

export default function RegistrationWizard() {
  const [regStatus, setRegStatus] = useState<RegistrationStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [step, setStep] = useState(0); // 0=cuenta, 1=equipo, 2=éxito
  const [username, setUsername] = useState("");

  useEffect(() => {
    fetchRegistrationStatus()
      .then(setRegStatus)
      .catch(() => setRegStatus(null))
      .finally(() => setLoadingStatus(false));
  }, []);

  useEffect(() => {
    if (regStatus && !regStatus.registration_open) {
      setRedirecting(true);
      showToast("error", "El registro está cerrado");
      location.href = "/login";
    }
  }, [regStatus]);

  if (loadingStatus || redirecting) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const needsTeamStep = regStatus
    ? regStatus.competition_mode === "teams" || regStatus.competition_mode === "mixed"
    : false;

  const stepLabels = needsTeamStep
    ? ["Cuenta", "Equipo", "Listo"]
    : ["Cuenta", "Listo"];

  const totalSteps = stepLabels.length;

  function onAccountSuccess(uname: string) {
    setUsername(uname);
    if (needsTeamStep) {
      setStep(1);
    } else {
      setStep(totalSteps - 1);
    }
  }

  function onTeamDone() {
    setStep(totalSteps - 1);
  }

  const displayStep = Math.min(step, totalSteps - 1);

  return (
    <div>
      <StepBar step={displayStep} total={totalSteps} labels={stepLabels} />

      {step === 0 && regStatus && (
        <Step1Account status={regStatus} onSuccess={onAccountSuccess} />
      )}

      {step === 1 && needsTeamStep && regStatus && (
        <Step2Team
          status={regStatus}
          onSuccess={onTeamDone}
          onSkip={onTeamDone}
        />
      )}

      {step === totalSteps - 1 && step > 0 && (
        <Step3Success username={username} />
      )}
    </div>
  );
}
