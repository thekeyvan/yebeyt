import { sql } from "drizzle-orm";
import {
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => new Uint8Array(value),
});

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").unique(),
  usernameChangedAt: timestamptz("username_changed_at"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

/** One sign-in method of a user. `appleRefreshToken` is stored encrypted (see src/auth/secrets.ts). */
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
