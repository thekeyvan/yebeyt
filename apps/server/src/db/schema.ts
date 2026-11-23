import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => new Uint8Array(value),
});

export type Avatar = { face: string; eyes: string; hair: string; mouth: string; accessory: string; background: string };

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    username: text("username").unique(),
    usernameChangedAt: timestamptz("username_changed_at"),
    displayName: text("display_name"),
    avatar: jsonb("avatar").$type<Avatar>(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  // Lets the username search (a prefix match) use an index.
  (t) => [index("users_username_prefix").using("btree", t.username.op("text_pattern_ops"))],
);

/** One sign-in method of a user. `appleRefreshToken` is stored encrypted (see src/crypto.ts). */
export const identities = pgTable(
  "identities",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["apple", "google"] }).notNull(),
    subject: text("subject").notNull(),
    appleRefreshToken: text("apple_refresh_token"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [unique("identities_provider_subject").on(t.provider, t.subject), index("identities_user").on(t.userId)],
);

/** Refresh tokens. Only the sha256 of the token is stored. A family is one sign-in and its rotations. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    familyId: uuid("family_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamptz("expires_at").notNull(),
    usedAt: timestamptz("used_at"),
    revokedAt: timestamptz("revoked_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_family").on(t.familyId), index("sessions_user").on(t.userId)],
);

export const progress = pgTable("progress", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  points: integer("points").notNull().default(0),
  streakDays: integer("streak_days").notNull().default(0),
  streakLastDate: date("streak_last_date", { mode: "string" }),
  bestByGame: jsonb("best_by_game").$type<Record<string, number>>().notNull().default({}),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

export const poetPictures = pgTable("poet_pictures", {
  slug: text("slug").primaryKey(),
  contentType: text("content_type").notNull(),
  bytes: bytea("bytes").notNull(),
  sha256: text("sha256").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

/** A kept couplet, synced from the phone. `key` is "<poemPath>#<coupletIndex>"; kept when keptAt > removedAt. */
export const divanItems = pgTable(
  "divan_items",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    keptAt: timestamptz("kept_at"),
    removedAt: timestamptz("removed_at"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

export const privacySettings = pgTable("privacy_settings", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  keptVisibility: text("kept_visibility", { enum: ["friends", "me"] }).notNull(),
  dailyVisibility: text("daily_visibility", { enum: ["friends", "me"] }).notNull(),
  showOnline: boolean("show_online").notNull(),
  inGlobalLeaderboard: boolean("in_global_leaderboard").notNull(),
  messagesFrom: text("messages_from", { enum: ["all", "friends"] }).notNull(),
  gameInvitesFrom: text("game_invites_from", { enum: ["all", "friends"] }).notNull(),
  allowReposts: boolean("allow_reposts").notNull(),
});

export type FeedbackGame = { name?: string; how: string; players: "solo" | "friends" | "both" };

/**
 * A feedback report. `userId` is null for guests and after the account is deleted (the text stays as anonymous feedback).
 * Only the sha256 of the upload token is stored. No IP, location or device identifier is ever stored.
 */
export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type", { enum: ["bug", "annoyed", "idea", "game", "liked"] }).notNull(),
    text: text("text"),
    frequency: text("frequency", { enum: ["always", "sometimes", "once"] }),
    game: jsonb("game").$type<FeedbackGame>(),
    screen: text("screen"),
    technical: jsonb("technical").$type<Record<string, unknown>>(),
    appVersion: text("app_version").notNull(),
    deviceModel: text("device_model").notNull(),
    osVersion: text("os_version").notNull(),
    uploadTokenHash: text("upload_token_hash").notNull(),
    uploadExpiresAt: timestamptz("upload_expires_at").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [index("feedback_created").on(t.createdAt, t.id)],
);

/** A screenshot or screen recording of a report; at most one of each kind. */
export const feedbackAttachments = pgTable(
  "feedback_attachments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    feedbackId: uuid("feedback_id").notNull().references(() => feedback.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["screenshot", "recording"] }).notNull(),
    contentType: text("content_type").notNull(),
    bytes: bytea("bytes").notNull(),
    size: integer("size").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [unique("feedback_attachments_kind").on(t.feedbackId, t.kind)],
);

const userRef = (name: string) => uuid(name).notNull().references(() => users.id, { onDelete: "cascade" });

/** `followerId` follows `followeeId`. Two people who follow each other are friends. */
export const follows = pgTable(
  "follows",
  {
    followerId: userRef("follower_id"),
    followeeId: userRef("followee_id"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    check("follows_not_self", sql`${t.followerId} <> ${t.followeeId}`),
    index("follows_follower_created").on(t.followerId, t.createdAt, t.followeeId),
    index("follows_followee_created").on(t.followeeId, t.createdAt, t.followerId),
  ],
);

export const GAMES = ["daily", "jigsaw", "poet", "second", "book", "match", "listen", "onboarding"] as const;
export type Game = (typeof GAMES)[number];

/** One finished round, reported by the phone. `id` is the round id the phone made, so a retry cannot count twice. `week` is the Tehran week the server received it in. */
export const scoreEvents = pgTable(
  "score_events",
  {
    id: uuid("id").primaryKey(),
    userId: userRef("user_id"),
    game: text("game", { enum: GAMES }).notNull(),
    points: integer("points").notNull(),
    playedAt: timestamptz("played_at").notNull(),
    week: text("week").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("score_events_points", sql`${t.points} >= 0`),
    index("score_events_user_week").on(t.userId, t.week),
    index("score_events_week_user").on(t.week, t.userId, t.points),
  ],
);

/** The daily puzzle's result for one Tehran day. */
export const dailyResults = pgTable(
  "daily_results",
  {
    userId: userRef("user_id"),
    date: date("date", { mode: "string" }).notNull(),
    solved: boolean("solved").notNull(),
    tries: integer("tries").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.date] }),
    check("daily_results_tries", sql`${t.tries} between 1 and 3`),
    index("daily_results_user_created").on(t.userId, t.createdAt),
  ],
);

/** A league group of one week and tier. `memberCount` is kept by the join (under a lock), so finding a group with room costs one indexed read. */
export const leagueGroups = pgTable(
  "league_groups",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    week: text("week").notNull(),
    tier: integer("tier").notNull(),
    memberCount: integer("member_count").notNull().default(0),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [check("league_groups_tier", sql`${t.tier} between 0 and 4`), index("league_groups_open").on(t.week, t.tier, t.memberCount)],
);

/** A user's place in a week's league. One group per user and week. */
export const leagueMembers = pgTable(
  "league_members",
  {
    groupId: uuid("group_id").notNull().references(() => leagueGroups.id, { onDelete: "cascade" }),
    userId: userRef("user_id"),
    week: text("week").notNull(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] }), unique("league_members_user_week").on(t.userId, t.week)],
);

/** The tier a user plays in next: the result of the last closed week they were in (no row means tier 0). */
export const userTiers = pgTable("user_tiers", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  tier: integer("tier").notNull(),
  fromWeek: text("from_week").notNull(),
});

/** Weeks whose leagues are closed (tiers computed). */
export const leagueClosures = pgTable("league_closures", {
  week: text("week").primaryKey(),
  closedAt: timestamptz("closed_at").notNull().defaultNow(),
});

/** A like or a repost of a couplet. `key` is "<poemPath>#<coupletIndex>". */
export const reactions = pgTable(
  "reactions",
  {
    userId: userRef("user_id"),
    key: text("key").notNull(),
    kind: text("kind", { enum: ["like", "repost"] }).notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.key, t.kind] }),
    index("reactions_key_kind").on(t.key, t.kind),
    index("reactions_user_created").on(t.userId, t.createdAt),
  ],
);
