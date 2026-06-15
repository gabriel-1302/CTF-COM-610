import { useCallback, useEffect, useState } from "react";
import {
  createTeam,
  fetchMe,
  fetchMyTeam,
  joinTeam,
  kickTeamMember,
  leaveTeam,
  transferTeamCaptain,
} from "../../lib/api";
import type { Team, User } from "../../lib/schemas";
import { showToast } from "../../lib/toast";
import { IconShield, IconLink, IconCrown, IconCheck, IconCopy, IconX } from "./icons";

type Status = "loading" | "no-team" | "in-team" | "error";

function avatarColor(name: string): string {
  const palette = ["#503AA8", "#1A3A7A", "#2563EB", "#059669", "#D97706", "#7C3AED", "#DB2777", "#0891B2"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

function apiMsg(err: unknown, fallback: string): string {
  const e = err as any;
  return (
    e?.response?.data?.detail ??
    e?.response?.data?.name?.[0] ??
    e?.response?.data?.join_code?.[0] ??
    fallback
  );
}

export default function TeamPanel() {
  const [status, setStatus] = useState<Status>("loading");
  const [team, setTeam] = useState<Team | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [kickTarget, setKickTarget] = useState<number | null>(null);
  const [transferTarget, setTransferTarget] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, u] = await Promise.all([fetchMyTeam(), fetchMe()]);
      setMe(u);
      setTeam(t);
      setStatus(t ? "in-team" : "no-team");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const t = await createTeam(teamName.trim());
      setTeam(t);
      setStatus("in-team");
      setTeamName("");
      showToast("success", `Equipo "${t.name}" creado.`);
    } catch (err) {
      showToast("error", apiMsg(err, "No se pudo crear el equipo."));
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const t = await joinTeam(joinCode.trim().toUpperCase());
      setTeam(t);
      setStatus("in-team");
      setJoinCode("");
      showToast("success", `Te uniste al equipo "${t.name}".`);
    } catch (err) {
      showToast("error", apiMsg(err, "Código de invitación inválido."));
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    setBusy(true);
    try {
      await leaveTeam();
      setTeam(null);
      setStatus("no-team");
      setConfirmLeave(false);
      showToast("success", "Saliste del equipo.");
    } catch (err) {
      showToast("error", apiMsg(err, "No se pudo salir del equipo."));
      setConfirmLeave(false);
    } finally {
      setBusy(false);
    }
  };

  const handleKick = async (userId: number) => {
    setBusy(true);
    try {
      await kickTeamMember(userId);
      await load();
      setKickTarget(null);
      showToast("success", "Miembro expulsado.");
    } catch (err) {
      showToast("error", apiMsg(err, "Error al expulsar."));
      setKickTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const handleTransfer = async (userId: number) => {
    setBusy(true);
    try {
      const t = await transferTeamCaptain(userId);
      setTeam(t);
      setTransferTarget(null);
      showToast("success", "Capitanía transferida.");
    } catch (err) {
      showToast("error", apiMsg(err, "Error al transferir capitanía."));
      setTransferTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const copyCode = () => {
    if (!team) return;
    navigator.clipboard.writeText(team.join_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const resetActions = () => {
    setKickTarget(null);
    setTransferTarget(null);
  };

  const isCaptain = !!(team && me && team.captain_username === me.username);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <div
          className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="card text-center py-16 max-w-md mx-auto">
        <p className="text-base mb-4" style={{ color: "var(--error)" }}>
          Error al cargar la información del equipo.
        </p>
        <button onClick={load} className="btn-ghost">Reintentar</button>
      </div>
    );
  }

  // ── No team ────────────────────────────────────────────────────────────────
  if (status === "no-team") {
    return (
      <div className="animate-fade-in max-w-2xl mx-auto">
        <div className="rounded-lg p-5 mb-8 text-sm" style={{ background: "var(--usfx-blue-light)", border: "1px solid #c3cfdf", color: "var(--usfx-blue)" }}>
          <strong>Modo competencia:</strong> en la competencia se puntúa por equipos. Cada miembro resuelve retos — los puntos se acumulan para el equipo.
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {/* Crear equipo */}
          <div className="card flex flex-col">
            <div className="mb-5">
              <div className="w-10 h-10 rounded-lg mb-3 flex items-center justify-center" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                <IconShield className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>Crear equipo</h2>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                Serás el capitán. Comparte el código con tus compañeros.
              </p>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-3 mt-auto">
              <input
                className="input-field"
                type="text"
                placeholder="Nombre del equipo"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                minLength={3}
                maxLength={64}
                required
                disabled={busy}
                autoComplete="off"
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={busy || teamName.trim().length < 3}
              >
                {busy ? "Creando..." : "Crear equipo"}
              </button>
            </form>
          </div>

          {/* Unirse */}
          <div className="card flex flex-col">
            <div className="mb-5">
              <div className="w-10 h-10 rounded-lg mb-3 flex items-center justify-center" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                <IconLink className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>Unirse a un equipo</h2>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                Ingresa el código de 8 caracteres que te dio tu capitán.
              </p>
            </div>
            <form onSubmit={handleJoin} className="flex flex-col gap-3 mt-auto">
              <input
                className="input-field font-mono tracking-widest text-center uppercase"
                type="text"
                placeholder="A3F2B891"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 8))}
                minLength={8}
                maxLength={8}
                required
                disabled={busy}
                autoComplete="off"
              />
              <button
                type="submit"
                className="btn-secondary"
                disabled={busy || joinCode.length !== 8}
              >
                {busy ? "Uniéndose..." : "Unirse al equipo"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── In team ────────────────────────────────────────────────────────────────
  if (!team || !me) return null;

  const members = team.members.slice().sort((a, b) => {
    if (a.is_captain) return -1;
    if (b.is_captain) return 1;
    return b.score - a.score;
  });

  return (
    <div className="animate-fade-in space-y-5">
      {/* Team header */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1 flex-wrap">
              <span className="text-xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
                {team.name}
              </span>
              {team.is_banned && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded"
                  style={{ background: "var(--error-bg)", color: "var(--error)", border: "1px solid var(--error-border)" }}
                >
                  Baneado
                </span>
              )}
              {isCaptain && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded inline-flex items-center gap-1"
                  style={{ background: "var(--gold)", color: "var(--gold-text)" }}
                >
                  <IconCrown className="w-4 h-4" /> Capitán
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              <span style={{ color: "var(--text)" }}>{team.member_count}</span> / 5 miembros
              &nbsp;·&nbsp;
              Capitán: <span style={{ color: "var(--text)" }}>{team.captain_username}</span>
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold" style={{ color: "var(--primary)" }}>
              {team.score.toLocaleString()}&thinsp;<span className="text-base font-medium" style={{ color: "var(--text-muted)" }}>pts</span>
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {team.solved_count} {team.solved_count === 1 ? "reto resuelto" : "retos resueltos"}
            </p>
          </div>
        </div>

        {/* Join code */}
        <div
          className="mt-4 pt-4 flex flex-wrap items-center gap-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>Código de invitación:</span>
          <code
            className="px-3 py-1.5 rounded font-mono font-bold tracking-[0.2em] text-sm"
            style={{ background: "var(--surface-alt)", color: "var(--primary)", border: "1px solid var(--border)" }}
          >
            {team.join_code}
          </code>
          <button onClick={copyCode} className="btn-ghost text-xs py-1.5 px-3 inline-flex items-center gap-1">
            {copied ? <><IconCheck className="w-3.5 h-3.5" />Copiado</> : <><IconCopy className="w-3.5 h-3.5" />Copiar</>}
          </button>
        </div>
      </div>

      {/* Members */}
      <div className="card">
        <h2 className="font-semibold mb-4" style={{ color: "var(--text)" }}>
          Miembros del equipo
        </h2>

        <div className="space-y-2">
          {members.map(member => {
            const isMe = member.username === me.username;
            const isKickTarget = kickTarget === member.user_id;
            const isTransferTarget = transferTarget === member.user_id;

            return (
              <div
                key={member.user_id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg"
                style={{
                  background: isMe ? "var(--primary-light)" : "var(--surface-alt)",
                  border: `1px solid ${isMe ? "var(--primary-border)" : "var(--border-subtle)"}`,
                }}
              >
                {/* Left: avatar + info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 select-none"
                    style={{ background: avatarColor(member.username) }}
                  >
                    {member.username[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                        {member.username}
                      </span>
                      {isMe && (
                        <span className="text-xs" style={{ color: "var(--text-faint)" }}>(tú)</span>
                      )}
                      {member.is_captain && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-0.5"
                          style={{ background: "var(--gold)", color: "var(--gold-text)" }}
                        >
                          <IconCrown className="w-3 h-3" /> Capitán
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {member.score.toLocaleString()} pts · {member.solved_count} retos
                    </p>
                  </div>
                </div>

                {/* Right: captain actions (only for non-self, non-captain members) */}
                {isCaptain && !isMe && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isKickTarget ? (
                      <>
                        <button
                          onClick={() => handleKick(member.user_id)}
                          className="btn-danger text-xs py-1 px-2.5"
                          disabled={busy}
                        >
                          Confirmar expulsión
                        </button>
                        <button onClick={resetActions} className="btn-ghost text-xs py-1 px-2">
                          <IconX className="w-4 h-4" />
                        </button>
                      </>
                    ) : isTransferTarget ? (
                      <>
                        <button
                          onClick={() => handleTransfer(member.user_id)}
                          className="btn-primary text-xs py-1 px-2.5"
                          disabled={busy}
                        >
                          Confirmar transferencia
                        </button>
                        <button onClick={resetActions} className="btn-ghost text-xs py-1 px-2">
                          <IconX className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setTransferTarget(member.user_id); setKickTarget(null); }}
                          className="btn-ghost text-xs py-1 px-2 inline-flex items-center gap-1"
                          title="Transferir capitanía"
                        >
                          <IconCrown className="w-3.5 h-3.5" /> Transferir
                        </button>
                        <button
                          onClick={() => { setKickTarget(member.user_id); setTransferTarget(null); }}
                          className="btn-danger text-xs py-1 px-2"
                          title="Expulsar del equipo"
                        >
                          Expulsar
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Slots vacíos */}
          {Array.from({ length: 5 - team.member_count }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="p-3 rounded-lg flex items-center gap-3"
              style={{ border: "1px dashed var(--border)", opacity: 0.5 }}
            >
              <div
                className="w-9 h-9 rounded-full flex-shrink-0"
                style={{ background: "var(--surface-alt)", border: "1px dashed var(--border)" }}
              />
              <span className="text-sm" style={{ color: "var(--text-faint)" }}>Slot disponible</span>
            </div>
          ))}
        </div>
      </div>

      {/* Leave */}
      <div className="flex justify-end">
        {confirmLeave ? (
          <div
            className="flex flex-wrap items-center gap-3 p-4 rounded-lg w-full sm:w-auto"
            style={{ background: "var(--error-bg)", border: "1px solid var(--error-border)" }}
          >
            <p className="text-sm flex-1" style={{ color: "var(--error)" }}>
              {isCaptain && team.member_count > 1
                ? "Debes transferir la capitanía antes de salir del equipo."
                : "¿Confirmas que quieres salir del equipo?"}
            </p>
            <div className="flex gap-2">
              {!(isCaptain && team.member_count > 1) && (
                <button onClick={handleLeave} className="btn-danger" disabled={busy}>
                  {busy ? "Saliendo..." : "Sí, salir"}
                </button>
              )}
              <button onClick={() => setConfirmLeave(false)} className="btn-ghost">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmLeave(true)} className="btn-danger">
            Salir del equipo
          </button>
        )}
      </div>
    </div>
  );
}
