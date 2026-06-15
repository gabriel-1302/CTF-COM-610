import { atom, computed } from "nanostores";
import { persistentAtom } from "@nanostores/persistent";

// Access token en memoria — no en localStorage para evitar XSS
export const accessToken = atom<string | null>(null);

// Username persiste para mostrar UI consistente durante refresh silencioso
// Usamos JSON como encoder para que null se almacene como "null" JSON válido
// y no como la cadena vacía o literalmente "null"
export const currentUsername = persistentAtom<string | null>(
  "ctf:username",
  null,
  {
    encode: JSON.stringify,
    decode: (v) => {
      try { return JSON.parse(v); } catch { return null; }
    },
  }
);

export const isAuthenticated = computed(accessToken, (t) => t !== null);

export const isAdmin = persistentAtom<boolean>(
  "ctf:isAdmin",
  false,
  {
    encode: JSON.stringify,
    decode: (v) => { try { return JSON.parse(v); } catch { return false; } },
  }
);

export function setAuth(token: string, username: string) {
  accessToken.set(token);
  currentUsername.set(username);
}

// null = cargando (default: mostrar), false = cerrado, true = abierto
export const registrationOpen = atom<boolean | null>(null);

export function clearAuth() {
  accessToken.set(null);
  currentUsername.set(null);
  try { localStorage.removeItem("ctf:username"); } catch {}
  isAdmin.set(false);
  try { localStorage.removeItem("ctf:isAdmin"); } catch {}
}
