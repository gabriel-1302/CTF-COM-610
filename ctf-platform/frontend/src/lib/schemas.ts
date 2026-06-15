import { z } from "zod";

export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  score: z.number().int().nonnegative(),
  solved_count: z.number().int().nonnegative(),
  is_staff: z.boolean().default(false),
});
export type User = z.infer<typeof UserSchema>;

export const TokenPairSchema = z.object({
  access: z.string(),
  refresh: z.string().optional(),
});

export const HintDetailSchema = z.object({
  index: z.number(),
  cost: z.number(),
  text: z.string().nullable(),
  unlocked: z.boolean(),
});
export type HintDetail = z.infer<typeof HintDetailSchema>;

export const ChallengeSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  points: z.number().int().positive(),
  current_points: z.number().int().nonnegative().optional(),
  min_points: z.number().int().nonnegative().optional(),
  decay: z.number().int().nonnegative().optional(),
  solve_count: z.number().int().nonnegative().optional(),
  is_dynamic: z.boolean().optional().default(false),
  first_blood_username: z.string().nullable().optional(),
  hints: z.array(z.object({ text: z.string(), cost: z.number() })).default([]),
  hints_detail: z.array(HintDetailSchema).optional(),
  is_solved: z.boolean(),
});
export type Challenge = z.infer<typeof ChallengeSchema>;

export const FirstBloodEventSchema = z.object({
  challenge_slug: z.string(),
  challenge_name: z.string(),
  username: z.string(),
  team_name: z.string().nullable().optional(),
  points_earned: z.number(),
});
export type FirstBloodEvent = z.infer<typeof FirstBloodEventSchema>;

export const SpawnResponseSchema = z.object({
  id: z.number(),
  url: z.string().url().optional().nullable(),
  host_port: z.number().optional().nullable(),
  expires_at: z.string(),
  ttl_seconds: z.number().int().nonnegative().optional(),
  status: z.string().optional(),
  challenge_slug: z.string().optional(),
});
export type SpawnResponse = z.infer<typeof SpawnResponseSchema>;

export const SubmitResponseSchema = z.object({
  correct: z.boolean(),
  points_earned: z.number().optional().nullable(),
  message: z.string().optional(),
  detail: z.string().optional(),
});
export type SubmitResponse = z.infer<typeof SubmitResponseSchema>;

export const ScoreboardEntrySchema = z.object({
  username: z.string(),
  score: z.number().int().nonnegative(),
  solved_count: z.number().int().nonnegative(),
});
export type ScoreboardEntry = z.infer<typeof ScoreboardEntrySchema>;

export const ProfileSolveSchema = z.object({
  challenge_slug: z.string(),
  challenge_name: z.string(),
  points: z.number(),
  solved_at: z.string(),
});

export const ProfileSchema = z.object({
  username: z.string(),
  email: z.string(),
  score: z.number(),
  solved_count: z.number(),
  rank: z.number(),
  hints_used: z.number(),
  hints_used_slugs: z.array(z.string()).default([]),
  total_players: z.number().default(1),
  top3_score: z.number().nullable().default(null),
  solves: z.array(ProfileSolveSchema),
  date_joined: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const HintUnlockResponseSchema = z.object({
  text: z.string(),
  cost: z.number(),
  already_unlocked: z.boolean(),
  points_deducted: z.number().optional(),
});
export type HintUnlockResponse = z.infer<typeof HintUnlockResponseSchema>;

export const AdminStudentSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  score: z.number(),
  solved_count: z.number(),
  hints_used: z.number(),
  web_solved: z.number(),
  crypto_solved: z.number(),
  forense_solved: z.number(),
  date_joined: z.string(),
  rank: z.number(),
});
export type AdminStudent = z.infer<typeof AdminStudentSchema>;

export const AdminChallengeSchema = z.object({
  slug: z.string(),
  name: z.string(),
  points: z.number(),
  is_active: z.boolean(),
  solve_count: z.number(),
  total_students: z.number(),
});
export type AdminChallenge = z.infer<typeof AdminChallengeSchema>;

export const AdminStudentsResponseSchema = z.object({
  total_challenges: z.number(),
  students: z.array(AdminStudentSchema),
});

// ─── Competition config ───────────────────────────────────────────────────────

export const CompetitionConfigSchema = z.object({
  name: z.string().default("CTF USFX"),
  description: z.string().default(""),
  competition_mode: z.boolean().default(false),
  mode: z.enum(["individual", "teams", "mixed"]).default("teams"),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  is_frozen: z.boolean().default(false),
  freeze_time: z.string().nullable().optional(),
  max_teams: z.number().nullable().optional(),
  max_members: z.number().default(5),
  registration_open: z.boolean().default(true),
  challenge_slugs: z.array(z.string()).default([]),
  dynamic_scoring: z.boolean().default(false),
  first_blood_bonus_pct: z.number().default(0),
  updated_at: z.string().optional(),
});
export type CompetitionConfig = z.infer<typeof CompetitionConfigSchema>;

export type CompetitionPhase = "inactive" | "pending" | "active" | "frozen" | "ended";

export const ActivityEntrySchema = z.object({
  username: z.string(),
  team_name: z.string().nullable().optional(),
  challenge_name: z.string(),
  challenge_slug: z.string(),
  points: z.number(),
  is_first_blood: z.boolean(),
  solved_at: z.string(),
});
export type ActivityEntry = z.infer<typeof ActivityEntrySchema>;

export const CompetitionStatsSchema = z.object({
  phase: z.enum(["inactive", "pending", "active", "frozen", "ended"]),
  participant_count: z.number(),
  team_count: z.number(),
  total_solves: z.number(),
  solves_last_hour: z.number(),
  recent_activity: z.array(ActivityEntrySchema),
});
export type CompetitionStats = z.infer<typeof CompetitionStatsSchema>;

export const ScoreboardResponseSchema = z.object({
  frozen: z.boolean(),
  freeze_time: z.string().nullable(),
  entries: z.array(ScoreboardEntrySchema),
});
export type ScoreboardResponse = z.infer<typeof ScoreboardResponseSchema>;

// ─── Teams ───────────────────────────────────────────────────────────────────

export const TeamMemberSchema = z.object({
  user_id: z.number(),
  username: z.string(),
  score: z.number(),
  solved_count: z.number(),
  is_captain: z.boolean(),
  joined_at: z.string(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const TeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  join_code: z.string(),
  captain_username: z.string().nullable().default(null),
  score: z.number(),
  solved_count: z.number(),
  member_count: z.number(),
  is_banned: z.boolean(),
  is_hidden: z.boolean(),
  members: z.array(TeamMemberSchema),
  created_at: z.string(),
});
export type Team = z.infer<typeof TeamSchema>;

export const RegistrationStatusSchema = z.object({
  registration_open: z.boolean(),
  competition_name: z.string(),
  competition_description: z.string(),
  competition_mode: z.enum(["individual", "teams", "mixed"]),
  competition_active: z.boolean(),
  teams_count: z.number(),
  teams_remaining: z.number().nullable(),
  max_teams: z.number().nullable(),
  max_members: z.number(),
});
export type RegistrationStatus = z.infer<typeof RegistrationStatusSchema>;

export const TeamScoreboardEntrySchema = z.object({
  id: z.number(),
  name: z.string(),
  score: z.number(),
  solved_count: z.number(),
  member_count: z.number(),
  captain_username: z.string().nullable().default(null),
});
export type TeamScoreboardEntry = z.infer<typeof TeamScoreboardEntrySchema>;
