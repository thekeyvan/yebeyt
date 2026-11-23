import { sql } from "drizzle-orm";
import {
  boolean,
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

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").unique(),
  usernameChangedAt: timestamptz("username_changed_at"),
  displayName: text("display_name"),
  avatar: jsonb("avatar").$type<Avatar>(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

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
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});
