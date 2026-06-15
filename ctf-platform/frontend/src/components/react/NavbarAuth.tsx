import { useStore } from "@nanostores/react";
import { useState, useEffect } from "react";
import { accessToken, currentUsername, clearAuth, isAdmin, registrationOpen } from "../../lib/auth";
import { api, fetchCompetitionConfig } from "../../lib/api";
import ConfirmDialog from "./ConfirmDialog";
import { IconLogOut } from "./icons";

interface Props {
  currentPath: string;
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export default function NavbarAuth({ currentPath }: Props) {
  const token = useStore(accessToken);
  const user = useStore(currentUsername);
  const admin = useStore(isAdmin);
  const canRegister = useStore(registrationOpen);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchCompetitionConfig()
      .then(cfg => registrationOpen.set(cfg.registration_open))
      .catch(() => {});
  }, []);

  const navLinkCls = (href: string) => {
    const active = currentPath.startsWith(href);
    return `text-sm font-medium px-3 py-1.5 rounded-md nav-link${active ? " nav-link--active" : ""}`;
  };

  const ariaCurrent = (href: string): "page" | undefined =>
    currentPath.startsWith(href) ? "page" : undefined;

  const handleLogout = async () => {
    try { await api.post("/auth/logout/"); } catch {}
    clearAuth();
    location.href = "/";
  };

  if (!mounted || (!user && token === null)) {
    return (
      <div className="flex items-center gap-1 sm:gap-2 animate-fade-in">
        <a href="/login" className="text-sm font-medium px-3 py-1.5 rounded-md nav-link">
          Iniciar sesión
        </a>
        {canRegister !== false && (
          <a href="/register" className="btn-primary text-sm py-1.5 px-4">
            Registrarse
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2 animate-fade-in">
      {admin && (
        <>
          <a href="/admin" className={navLinkCls("/admin")} aria-current={ariaCurrent("/admin")}>
            Admin
          </a>
          <a href="/admin/competencia" className={navLinkCls("/admin/competencia")} aria-current={ariaCurrent("/admin/competencia")}>
            Competencia
          </a>
        </>
      )}
      <a href="/competencia" className={navLinkCls("/competencia")} aria-current={ariaCurrent("/competencia")}>
        Competencia
      </a>
      <a href="/team" className={navLinkCls("/team")} aria-current={ariaCurrent("/team")}>
        Equipo
      </a>
      <a href="/profile" className={navLinkCls("/profile")} aria-current={ariaCurrent("/profile")}>
        Perfil
      </a>

      {/* Avatar pill con username */}
      {user && (
        <span
          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{
            background: "var(--primary-light)",
            color: "var(--primary)",
            border: "1px solid var(--primary-border)",
          }}
          aria-label={`Sesión iniciada como ${user}`}
        >
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
            style={{ background: "var(--primary)", color: "#fff" }}
            aria-hidden="true"
          >
            {initials(user)}
          </span>
          {user}
        </span>
      )}

      <button
        onClick={() => setLogoutOpen(true)}
        className="btn-logout"
        aria-label="Cerrar sesión"
      >
        <IconLogOut className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Salir</span>
      </button>

      {logoutOpen && (
        <ConfirmDialog
          title="¿Cerrar sesión?"
          description="Saldrás de tu cuenta. Podrás volver a iniciar sesión cuando quieras."
          confirmLabel="Cerrar sesión"
          cancelLabel="Cancelar"
          onConfirm={handleLogout}
          onClose={() => setLogoutOpen(false)}
        />
      )}
    </div>
  );
}
