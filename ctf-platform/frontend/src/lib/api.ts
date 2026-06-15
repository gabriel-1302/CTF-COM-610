import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import { accessToken, clearAuth, isAdmin } from "./auth";
import {
  AdminChallengeSchema,
  AdminStudentsResponseSchema,
  ChallengeSchema,
  SpawnResponseSchema,
  SubmitResponseSchema,
  TokenPairSchema,
  UserSchema,
  ScoreboardResponseSchema,
  ProfileSchema,
  HintUnlockResponseSchema,
  TeamSchema,
  TeamScoreboardEntrySchema,
  CompetitionConfigSchema,
  CompetitionStatsSchema,
  RegistrationStatusSchema,
  type Team,
  type ScoreboardResponse,
  type CompetitionConfig,
  type CompetitionStats,
  type RegistrationStatus,
} from "./schemas";
import { z } from "zod";

export const api = axios.create({
  baseURL: import.meta.env.PUBLIC_API_BASE ?? "/api",
  withCredentials: true,
  timeout: 15000,
});

// Request interceptor: añade Authorization si hay token
api.interceptors.request.use((config) => {
  const token = accessToken.get();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: refresh automático en 401
// Promise compartido para deduplicar múltiples llamadas concurrentes
let refreshing: Promise<string> | null = null;

async function refreshAccess(): Promise<string> {
  const base = import.meta.env.PUBLIC_API_BASE ?? "/api";
  const res = await axios.post(
    `${base}/auth/token/refresh/`,
    {},
    { withCredentials: true }
  );
  const token = res.data.access as string;
  accessToken.set(token);
  return token;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        refreshing = refreshing ?? refreshAccess().finally(() => (refreshing = null));
        const token = await refreshing;
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return api.request(original);
      } catch {
        clearAuth();
        if (typeof window !== "undefined") window.location.href = "/login";
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

// ─── Funciones de dominio ────────────────────────────────────────────────────

export async function login(username: string, password: string) {
  const { data } = await api.post("/auth/login/", { username, password });
  return TokenPairSchema.parse(data);
}

export async function register(username: string, email: string, password: string) {
  await api.post("/auth/register/", { username, email, password });
}

export async function fetchMe() {
  const { data } = await api.get("/auth/me/");
  const user = UserSchema.parse(data);
  isAdmin.set(user.is_staff ?? false);
  return user;
}

export async function fetchChallenges(all = false) {
  const { data } = await api.get(all ? "/challenges/?all=true" : "/challenges/");
  const list = Array.isArray(data) ? data : data.results ?? [];
  return z.array(ChallengeSchema).parse(list);
}

export async function spawnInstance(slug: string) {
  const { data } = await api.post("/instances/spawn/", { challenge_slug: slug });
  return SpawnResponseSchema.parse(data);
}

export async function killInstance(instanceId: number) {
  await api.delete(`/instances/${instanceId}/`);
}

export async function fetchActiveInstances() {
  const { data } = await api.get("/instances/active/");
  const list: any[] = Array.isArray(data) ? data : data.results ?? [];
  // Normalizar: el backend devuelve challenge_slug/challenge_name, el frontend
  // espera challenge: { slug, name } para InstancePanel y ChallengeDetail
  return list.map((i) => ({
    id: i.id as number,
    host_port: i.host_port as number,
    expires_at: i.expires_at as string,
    status: i.status as string,
    url: i.url as string,
    challenge: {
      slug: i.challenge_slug as string,
      name: i.challenge_name as string,
    },
  }));
}

export async function submitFlag(slug: string, flag: string) {
  const { data } = await api.post(`/challenges/${slug}/submit/`, { flag });
  return SubmitResponseSchema.parse(data);
}

export async function fetchScoreboard(): Promise<ScoreboardResponse> {
  const { data } = await api.get("/auth/scoreboard/");
  return ScoreboardResponseSchema.parse(data);
}

export async function fetchCompetitionConfig(): Promise<CompetitionConfig> {
  const { data } = await api.get("/auth/competition/");
  return CompetitionConfigSchema.parse(data);
}

export async function setCompetitionConfig(
  patch: Partial<{
    name: string;
    description: string;
    competition_mode: boolean;
    mode: "individual" | "teams" | "mixed";
    start_time: string | null;
    end_time: string | null;
    is_frozen: boolean;
    freeze_time: string | null;
    max_teams: number | null;
    max_members: number;
    registration_open: boolean;
    challenge_slugs: string[];
    dynamic_scoring: boolean;
    first_blood_bonus_pct: number;
  }>
): Promise<CompetitionConfig> {
  const { data } = await api.patch("/auth/competition/", patch);
  return CompetitionConfigSchema.parse(data);
}

export async function fetchCompetitionStats(): Promise<CompetitionStats> {
  const { data } = await api.get("/auth/admin/competition/stats/");
  return CompetitionStatsSchema.parse(data);
}

export async function logout() {
  try {
    await api.post("/auth/logout/");
  } catch {
    // si no hay endpoint, continuamos
  }
  clearAuth();
  if (typeof window !== "undefined") window.location.href = "/";
}

export async function fetchProfile() {
  const { data } = await api.get("/auth/profile/");
  return ProfileSchema.parse(data);
}

export async function unlockHint(slug: string, index: number) {
  const { data } = await api.post(`/challenges/${slug}/hints/${index}/unlock/`);
  return HintUnlockResponseSchema.parse(data);
}

export async function fetchAdminStudents() {
  const { data } = await api.get("/auth/admin/students/");
  return AdminStudentsResponseSchema.parse(data);
}

export async function fetchAdminChallenges() {
  const { data } = await api.get("/challenges/admin/");
  const list = Array.isArray(data) ? data : [];
  return z.array(AdminChallengeSchema).parse(list);
}

export async function toggleChallenge(slug: string) {
  const { data } = await api.patch(`/challenges/admin/${slug}/toggle/`);
  return AdminChallengeSchema.partial().parse(data);
}

export async function fetchSolucionario(slug: string): Promise<{ html: string | null; found: boolean }> {
  const { data } = await api.get(`/challenges/admin/${slug}/solucionario/`);
  return data;
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export async function fetchMyTeam(): Promise<Team | null> {
  try {
    const { data } = await api.get("/teams/me/");
    return TeamSchema.parse(data);
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

export async function createTeam(name: string): Promise<Team> {
  const { data } = await api.post("/teams/", { name });
  return TeamSchema.parse(data);
}

export async function joinTeam(joinCode: string): Promise<Team> {
  const { data } = await api.post("/teams/join/", { join_code: joinCode });
  return TeamSchema.parse(data);
}

export async function leaveTeam(): Promise<void> {
  await api.delete("/teams/leave/");
}

export async function kickTeamMember(userId: number): Promise<void> {
  await api.post(`/teams/kick/${userId}/`);
}

export async function transferTeamCaptain(userId: number): Promise<Team> {
  const { data } = await api.post(`/teams/transfer/${userId}/`);
  return TeamSchema.parse(data);
}

export async function fetchTeamScoreboard() {
  const { data } = await api.get("/teams/scoreboard/");
  const list = Array.isArray(data) ? data : data.results ?? [];
  return z.array(TeamScoreboardEntrySchema).parse(list);
}

export async function resetScores(): Promise<string> {
  const { data } = await api.post("/auth/admin/reset/scores/");
  return data.message as string;
}

export async function resetTeams(): Promise<string> {
  const { data } = await api.post("/auth/admin/reset/teams/");
  return data.message as string;
}

export async function fetchRegistrationStatus(): Promise<RegistrationStatus> {
  const { data } = await axios.get(
    `${import.meta.env.PUBLIC_API_BASE ?? "/api"}/auth/registration-status/`
  );
  return RegistrationStatusSchema.parse(data);
}

export async function previewTeamByCode(joinCode: string): Promise<{ name: string; member_count: number; max_members: number } | null> {
  try {
    const { data } = await api.get(`/teams/lookup/?code=${encodeURIComponent(joinCode.toUpperCase())}`);
    return data as { name: string; member_count: number; max_members: number };
  } catch {
    return null;
  }
}
