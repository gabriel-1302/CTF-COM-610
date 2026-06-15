import { useState } from "react";
import { useStore } from "@nanostores/react";
import { login, register, fetchMe } from "../../lib/api";
import { setAuth, registrationOpen } from "../../lib/auth";
import { showToast } from "../../lib/toast";

interface Props {
  mode: "login" | "register";
}

export default function AuthForm({ mode }: Props) {
  const canRegister = useStore(registrationOpen);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parseError(err: any): string {
    const detail = err?.response?.data;
    if (!detail) return "Sin conexión con el servidor";
    if (typeof detail === "string") return detail;
    if (typeof detail === "object") {
      return Object.entries(detail)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
        .join(" · ");
    }
    return "Credenciales incorrectas";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        await register(username, email, password);
        showToast("success", "¡Cuenta creada!");
      }
      const { access } = await login(username, password);
      setAuth(access, username);
      fetchMe().catch(() => {});
      showToast("success", `Bienvenido, ${username}`);
      setTimeout(() => { location.href = "/challenges"; }, 500);
    } catch (err: any) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="auth-username" className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>
          Usuario
        </label>
        <input
          id="auth-username"
          type="text"
          autoComplete="username"
          className="input-field"
          placeholder="nombre de usuario"
          required
          minLength={3}
          maxLength={30}
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
      </div>

      {mode === "register" && (
        <div>
          <label htmlFor="auth-email" className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>
            Correo electrónico
          </label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            className="input-field"
            placeholder="correo@usfx.bo"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>
      )}

      <div>
        <label htmlFor="auth-password" className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>
          Contraseña
        </label>
        <input
          id="auth-password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="input-field"
          placeholder={mode === "register" ? "mínimo 8 caracteres" : "••••••••"}
          required
          minLength={8}
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <div role="alert" aria-live="polite"
             className="text-sm px-3 py-2.5 rounded-md"
             style={{ background: "var(--error-bg)", color: "var(--error)", border: "1px solid var(--error-border)" }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full mt-1"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            {mode === "login" ? "Entrando..." : "Creando cuenta..."}
          </span>
        ) : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
      </button>

      <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
        {mode === "login" && canRegister !== false && (
          <>
            ¿No tienes cuenta?{" "}
            <a href="/register" className="font-semibold underline underline-offset-2" style={{ color: "var(--primary)" }}>
              Registrarse
            </a>
          </>
        )}
        {mode === "register" && (
          <>
            ¿Ya tienes cuenta?{" "}
            <a href="/login" className="font-semibold underline underline-offset-2" style={{ color: "var(--primary)" }}>
              Iniciar sesión
            </a>
          </>
        )}
      </p>
    </form>
  );
}
