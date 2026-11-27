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
  uniqueIndex,
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
    /** The built-in demo friend «یه بیت» (src/house.ts): no identity, so nobody signs in as it. At most one user has it. */
    isHouse: boolean("is_house").notNull().default(false),
    /** When the person switched on «خبرهای یه بیت رو برام ایمیل کن» (news and offers by email); null is no. */
    newsOptInAt: timestamptz("news_opt_in_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    // Lets the username search (a prefix match) use an index.
    index("users_username_prefix").using("btree", t.username.op("text_pattern_ops")),
    uniqueIndex("users_one_house").on(t.isHouse).where(sql`${t.isHouse}`),
  ],
);

/**
 * One sign-in method of a user. `appleRefreshToken` is stored encrypted (see src/crypto.ts). `email` is the address the
 * provider said is verified (lower-cased, trimmed; Apple's private relay address too), null when it gave none. It runs the
 * account, links sign-in methods (two with one email are one person, src/users.ts) and is where mail to the person goes.
 * Never log it.
 */
export const identities = pgTable(
  "identities",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["apple", "google"] }).notNull(),
    subject: text("subject").notNull(),
    appleRefreshToken: text("apple_refresh_token"),
    email: text("email"),
    /** Whether `email` may join accounts: Apple's always; Google's only for @gmail.com or a Workspace domain (`hd`), where Google is the authority for the address. */
    emailLinkable: boolean("email_linkable").notNull().default(false),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [unique("identities_provider_subject").on(t.provider, t.subject), index("identities_user").on(t.userId), index("identities_email").on(t.email)],
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

/** Accepted friends. One row per pair, kept in order (`userLow` < `userHigh`). */
export const friendships = pgTable(
  "friendships",
  {
    userLow: userRef("user_low"),
    userHigh: userRef("user_high"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userLow, t.userHigh] }),
    check("friendships_order", sql`${t.userLow} < ${t.userHigh}`),
    index("friendships_high").on(t.userHigh),
  ],
);

/** `fromId` asked `toId` to be friends and waits for an answer. A request goes away when it is accepted, rejected, cancelled or blocked. */
export const friendRequests = pgTable(
  "friend_requests",
  {
    fromId: userRef("from_id"),
    toId: userRef("to_id"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.fromId, t.toId] }),
    check("friend_requests_not_self", sql`${t.fromId} <> ${t.toId}`),
    index("friend_requests_to_created").on(t.toId, t.createdAt, t.fromId),
    index("friend_requests_from_created").on(t.fromId, t.createdAt, t.toId),
  ],
);

/** The games the phone reports its own rounds of (`POST /v1/scores`). */
export const SOLO_GAMES = ["daily", "jigsaw", "poet", "second", "book", "match", "listen", "onboarding"] as const;
/** Every game that scores: the solo ones, and the two with a friend, which the server records itself when the game ends. */
export const GAMES = [...SOLO_GAMES, "mosh", "duel"] as const;
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
    /** The Tehran day the round was played, for the daily puzzle only (it counts once a day). */
    day: date("day", { mode: "string" }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("score_events_points", sql`${t.points} >= 0`),
    uniqueIndex("score_events_daily_once").on(t.userId, t.day).where(sql`${t.game} = 'daily'`),
    uniqueIndex("score_events_onboarding_once").on(t.userId).where(sql`${t.game} = 'onboarding'`),
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

/** `blockerId` blocked `blockedId`: neither can send a friend request, message or share a divan with the other, and they do not see each other's profile. */
export const blocks = pgTable(
  "blocks",
  {
    blockerId: userRef("blocker_id"),
    blockedId: userRef("blocked_id"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    check("blocks_not_self", sql`${t.blockerId} <> ${t.blockedId}`),
    index("blocks_blocker_created").on(t.blockerId, t.createdAt, t.blockedId),
    index("blocks_blocked").on(t.blockedId),
  ],
);

/** A one-to-one chat. `userLow` is the smaller id of the two, so a pair has one row. */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userLow: userRef("user_low"),
    userHigh: userRef("user_high"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [unique("conversations_pair").on(t.userLow, t.userHigh), check("conversations_order", sql`${t.userLow} < ${t.userHigh}`), index("conversations_high").on(t.userHigh)],
);

export type MessagePayload = { event: string; [key: string]: unknown };

/**
 * A chat message. `senderId` is null for a system line (its `payload` says what happened, and `by` is the user it came from).
 * A deleted message keeps its row (`deletedAt`) with the text, couplet and note cleared. `clientId` makes a send idempotent per sender.
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["text", "couplet", "system", "game"] }).notNull(),
    text: text("text"),
    coupletKey: text("couplet_key"),
    note: text("note"),
    payload: jsonb("payload").$type<MessagePayload>(),
    clientId: uuid("client_id"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    deletedAt: timestamptz("deleted_at"),
  },
  (t) => [
    check("messages_text_length", sql`char_length(${t.text}) <= 1000`),
    check("messages_note_length", sql`char_length(${t.note}) <= 200`),
    unique("messages_sender_client").on(t.senderId, t.clientId),
    index("messages_conversation_created").on(t.conversationId, t.createdAt.desc(), t.id.desc()),
  ],
);

/** How far a user has read a conversation. */
export const conversationReads = pgTable(
  "conversation_reads",
  {
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    userId: userRef("user_id"),
    lastReadMessageId: uuid("last_read_message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    lastReadAt: timestamptz("last_read_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] }), index("conversation_reads_message").on(t.lastReadMessageId)],
);

export const REPORT_REASONS = ["spam", "abuse", "other"] as const;

/**
 * A report of a person, or of one of their messages. It stays when either account is deleted (the id then becomes null).
 * The `message*` columns copy the message when it is reported, so it can still be read after the sender deletes it.
 */
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
    messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
    messageKind: text("message_kind", { enum: ["text", "couplet", "system", "game"] }),
    messageText: text("message_text"),
    messageKey: text("message_key"),
    messageNote: text("message_note"),
    reason: text("reason", { enum: REPORT_REASONS }).notNull(),
    note: text("note"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [check("reports_note_length", sql`char_length(${t.note}) <= 500`), index("reports_created").on(t.createdAt.desc(), t.id.desc()), index("reports_message").on(t.messageId)],
);

/** A divan two friends keep together. `userLow` is the smaller id of the two. */
export const sharedDivans = pgTable(
  "shared_divans",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userLow: userRef("user_low"),
    userHigh: userRef("user_high"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [unique("shared_divans_pair").on(t.userLow, t.userHigh), check("shared_divans_order", sql`${t.userLow} < ${t.userHigh}`), index("shared_divans_high").on(t.userHigh)],
);

export const sharedDivanItems = pgTable(
  "shared_divan_items",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    divanId: uuid("divan_id").notNull().references(() => sharedDivans.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    addedBy: userRef("added_by"),
    note: text("note"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("shared_divan_items_key").on(t.divanId, t.key),
    check("shared_divan_items_note_length", sql`char_length(${t.note}) <= 200`),
    index("shared_divan_items_divan_created").on(t.divanId, t.createdAt.desc(), t.id.desc()),
  ],
);

export const sharedDivanLikes = pgTable(
  "shared_divan_likes",
  {
    itemId: uuid("item_id").notNull().references(() => sharedDivanItems.id, { onDelete: "cascade" }),
    userId: userRef("user_id"),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.userId] })],
);

export const FRIEND_GAME_KINDS = ["mosh", "duel"] as const;
export type FriendGameKind = (typeof FRIEND_GAME_KINDS)[number];

/** One round of بازی رودررو, kept when the game ends: the deck couplet it asked about and who won the round. */
export type DuelRound = { round: number; type: "second" | "poet" | "book"; key: string; winnerId: string | null };

/**
 * A game with a friend: مشاعره (`mosh`, turns of `turnSeconds`) or بازی رودررو (`duel`, live). It waits for a second player,
 * is active while played and done when it ends (`winnerId` null when nobody won). A turn's deadline is `turnStartedAt` + `turnSeconds`. A waiting game nobody joins in 7 days ends as `expired`.
 * `createdBy` and `winnerId` become null when that account is deleted. `rounds` is for a finished duel.
 */
export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    kind: text("kind", { enum: FRIEND_GAME_KINDS }).notNull(),
    turnSeconds: integer("turn_seconds").notNull(),
    status: text("status", { enum: ["waiting", "active", "done"] }).notNull().default("waiting"),
    code: text("code").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    startedAt: timestamptz("started_at"),
    turnStartedAt: timestamptz("turn_started_at"),
    endedAt: timestamptz("ended_at"),
    winnerId: uuid("winner_id").references(() => users.id, { onDelete: "set null" }),
    endReason: text("end_reason", { enum: ["timeout", "resigned", "left", "finished", "expired"] }),
    rounds: jsonb("rounds").$type<DuelRound[]>(),
  },
  (t) => [
    check("games_turn_seconds", sql`${t.turnSeconds} in (8, 30, 120, 86400)`),
    // A code is free again once its game is done, so only the games still open need different codes.
    uniqueIndex("games_code_open").on(t.code).where(sql`${t.status} <> 'done'`),
    index("games_active_deadline").on(t.status, t.kind),
  ],
);

/** The two players of a game; seat 0 is the one who made it. Deleting an account removes its rows. */
export const gamePlayers = pgTable(
  "game_players",
  {
    gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    userId: userRef("user_id"),
    seat: integer("seat").notNull(),
    score: integer("score").notNull().default(0),
    joinedAt: timestamptz("joined_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.userId] }),
    unique("game_players_seat").on(t.gameId, t.seat),
    check("game_players_seat_range", sql`${t.seat} in (0, 1)`),
    index("game_players_user").on(t.userId),
  ],
);

/** A couplet played in a مشاعره game, in turn order (`n` from 1). `m1` and `m2` are Ganjoor's text for `key`. */
export const moshMoves = pgTable(
  "mosh_moves",
  {
    gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    n: integer("n").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    key: text("key").notNull(),
    m1: text("m1").notNull(),
    m2: text("m2").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.n] }), unique("mosh_moves_key").on(t.gameId, t.key)],
);

/**
 * A challenge: the same ten couplets of جورچین or حدس شاعر that `creatorId` played, with their score, shared by a link `yebeyt.com/c/<code>`.
 * Anyone may play it without an account. It expires after 30 days. Deleting the creator's account deletes it with all its results.
 */
export const challenges = pgTable(
  "challenges",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    code: text("code").notNull().unique(),
    game: text("game", { enum: ["jigsaw", "poet"] }).notNull(),
    creatorId: userRef("creator_id"),
    items: jsonb("items").$type<string[]>().notNull(),
    score: integer("score").notNull(),
    seconds: integer("seconds").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    expiresAt: timestamptz("expires_at").notNull(),
  },
  (t) => [check("challenges_score", sql`${t.score} between 0 and 10`), index("challenges_creator_created").on(t.creatorId, t.createdAt), index("challenges_expires").on(t.expiresAt)],
);

/** Someone's result on a challenge: a signed-in user (one result each), or a guest who left a `name`. Deleting a user's account deletes their results. */
export const challengeResults = pgTable(
  "challenge_results",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    challengeId: uuid("challenge_id").notNull().references(() => challenges.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name"),
    score: integer("score").notNull(),
    seconds: integer("seconds").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("challenge_results_user").on(t.challengeId, t.userId),
    check("challenge_results_score", sql`${t.score} between 0 and 10`),
    check("challenge_results_who", sql`${t.userId} is not null or ${t.name} is not null`),
    check("challenge_results_name_length", sql`char_length(${t.name}) <= 30`),
    index("challenge_results_user_idx").on(t.userId),
  ],
);
