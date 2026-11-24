import { z } from "@hono/zod-openapi";
import { and, asc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Db } from "./db/index.js";
import { type DuelRound, gamePlayers, games, messages, moshMoves, scoreEvents, users } from "./db/schema.js";
import type { Deps } from "./deps.js";
import { joinLeague } from "./leagues.js";
import { getOrCreateConversation, publishMessage } from "./messaging.js";
import { GAME_CAPS } from "./scores.js";
import { avatarSchema } from "./schemas.js";
import { weekOf } from "./week.js";

export const SWEEP_MS = 30_000;
const ORPHAN_DUEL_MS = 60_000;
/** Points a friend game adds to the weekly league: for each accepted couplet (مشاعره) or round won (رودررو), up to the game's cap in `GAME_CAPS`. */
export const POINTS_PER_UNIT = { mosh: 10, duel: 30 } as const;

type GameRow = typeof games.$inferSelect;
export type PlayerRow = { userId: string; username: string; displayName: string | null; avatar: typeof users.$inferSelect.avatar; seat: number; score: number };
type EndReason = NonNullable<GameRow["endReason"]>;

const playerSchema = z
  .object({ username: z.string(), displayName: z.string().nullable(), avatar: avatarSchema.nullable(), seat: z.number().int().min(0).max(1), score: z.number().int() })
  .openapi("GamePlayer");
const turnSchema = z
  .object({ username: z.string(), deadline: z.iso.datetime().openapi({ description: "When the turn runs out: the last move (or the start) plus `turnSeconds`." }) })
  .openapi("GameTurn");

export const gameSummarySchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(["mosh", "duel"]),
    turnSeconds: z.number().int().openapi({ description: "مشاعره: 30, 120 or 86400. رودررو: 8 (seconds a round)." }),
    status: z.enum(["waiting", "active", "done"]),
    code: z.string().openapi({ example: "7K3M", description: "Four characters (Crockford base32 without I, L, O, U); `yebeyt.com/g/<code>`." }),
    createdAt: z.iso.datetime(),
    endedAt: z.iso.datetime().nullable(),
    winner: z.string().nullable().openapi({ description: "The winner's username when the game is done and somebody won." }),
    endReason: z.enum(["timeout", "resigned", "left", "finished"]).nullable(),
    players: z.array(playerSchema),
    turn: turnSchema.nullable().openapi({ description: "مشاعره while active: whose turn it is. Null otherwise." }),
  })
  .openapi("GameSummary");

const moveSchema = z.object({ n: z.number().int(), username: z.string().nullable(), key: z.string(), m1: z.string(), m2: z.string(), createdAt: z.iso.datetime() }).openapi("MoshMove");
export const duelCoupletSchema = z
  .object({ round: z.number().int(), type: z.enum(["second", "poet", "book"]), key: z.string(), m1: z.string(), m2: z.string(), meaning: z.string(), poet: z.string(), bookTitle: z.string(), winner: z.string().nullable() })
  .openapi("DuelRoundResult");

export const gameSchema = gameSummarySchema
  .extend({
    moves: z.array(moveSchema).openapi({ description: "مشاعره: the couplets played, in order." }),
    rounds: z.array(duelCoupletSchema).openapi({ description: "رودررو once done: the five couplets with their meanings and who won each round." }),
  })
  .openapi("Game");

export type GameSummary = z.infer<typeof gameSummarySchema>;

/** The players of each game, by seat. */
export async function playersOf(db: Db, gameIds: string[]): Promise<Map<string, PlayerRow[]>> {
  const result = new Map<string, PlayerRow[]>(gameIds.map((id) => [id, []]));
  if (gameIds.length === 0) return result;
  const rows = await db
    .select({ gameId: gamePlayers.gameId, userId: gamePlayers.userId, username: users.username, displayName: users.displayName, avatar: users.avatar, seat: gamePlayers.seat, score: gamePlayers.score })
    .from(gamePlayers)
    .innerJoin(users, eq(users.id, gamePlayers.userId))
    .where(inArray(gamePlayers.gameId, gameIds))
    .orderBy(asc(gamePlayers.seat));
  for (const { gameId, ...player } of rows) result.get(gameId)!.push({ ...player, username: player.username! });
  return result;
}

/** The seat whose turn it is in an active مشاعره game: the creator opens, so it is the number of couplets played so far (the players' scores add up to it) that decides. */
export const turnSeatOf = (players: PlayerRow[]): number => players.reduce((sum, p) => sum + p.score, 0) % 2;

/** When the turn of an active مشاعره game runs out. */
export const deadlineOf = (game: GameRow): Date => new Date(game.turnStartedAt!.getTime() + game.turnSeconds * 1000);

export function summaryOf(game: GameRow, players: PlayerRow[]): GameSummary {
  const winner = players.find((p) => p.userId === game.winnerId);
  const onTurn = game.kind === "mosh" && game.status === "active" ? players.find((p) => p.seat === turnSeatOf(players)) : undefined;
  return {
    id: game.id,
    kind: game.kind,
    turnSeconds: game.turnSeconds,
    status: game.status,
    code: game.code,
    createdAt: game.createdAt.toISOString(),
    endedAt: game.endedAt?.toISOString() ?? null,
    winner: winner?.username ?? null,
    endReason: game.endReason,
    players: players.map(({ userId: _id, ...p }) => p),
    turn: onTurn ? { username: onTurn.username, deadline: deadlineOf(game).toISOString() } : null,
  };
}

/** The couplets of a finished duel's rounds, with their meanings and who won each. */
export function duelRoundViews(data: Deps["data"], rounds: DuelRound[], players: PlayerRow[]) {
  return rounds.flatMap((r) => {
    const couplet = data.byKey.get(r.key);
    if (!couplet) return [];
    const winner = players.find((p) => p.userId === r.winnerId)?.username ?? null;
    return [{ round: r.round, type: r.type, key: r.key, m1: couplet.m1, m2: couplet.m2, meaning: couplet.meaning, poet: couplet.poet, bookTitle: couplet.bookTitle, winner }];
  });
}

/** The whole game: the summary, the couplets played (مشاعره) and the rounds of a finished duel. */
export async function gameView(deps: Deps, game: GameRow, players: PlayerRow[]) {
  const name = (id: string | null) => players.find((p) => p.userId === id)?.username ?? null;
  const moves = await deps.db.select().from(moshMoves).where(eq(moshMoves.gameId, game.id)).orderBy(asc(moshMoves.n));
  return {
    ...summaryOf(game, players),
    moves: moves.map((m) => ({ n: m.n, username: name(m.userId), key: m.key, m1: m.m1, m2: m.m2, createdAt: m.createdAt.toISOString() })),
    rounds: duelRoundViews(deps.data, game.rounds ?? [], players),
  };
}

/**
 * Ends a game once: marks it done, records the points of both players for the weekly league (`mosh` and `duel` score events, capped), puts a
 * system line in their chat and tells both. Returns false when it was already done, so two callers racing change nothing twice.
 * `extra` is added to the live `game.ended` event.
 */
export async function endGame(deps: Deps, gameId: string, winnerId: string | null, reason: EndReason, extra: Record<string, unknown> = {}): Promise<boolean> {
  const now = deps.now();
  const ended = await deps.db.transaction(async (tx) => {
    const [game] = await tx
      .update(games)
      .set({ status: "done", endedAt: now, winnerId, endReason: reason })
      .where(and(eq(games.id, gameId), ne(games.status, "done")))
      .returning();
    if (!game) return null;
    const players = (await playersOf(tx, [gameId])).get(gameId)!;
    const week = weekOf(now);
    for (const p of players) {
      const points = Math.min(p.score * POINTS_PER_UNIT[game.kind], GAME_CAPS[game.kind]);
      if (points === 0) continue;
      await tx.insert(scoreEvents).values({ id: randomUUID(), userId: p.userId, game: game.kind, points, playedAt: now, week, createdAt: now });
      await joinLeague(tx, p.userId, week);
    }
    const [a, b] = players;
    let line;
    if (a && b) {
      const conversationId = await getOrCreateConversation(tx, a.userId, b.userId);
      [line] = await tx
        .insert(messages)
        .values({ conversationId, senderId: null, kind: "system", payload: { event: "game_ended", gameId, kind: game.kind, reason, ...(winnerId ? { by: winnerId } : {}) }, createdAt: now })
        .returning();
    }
    return { game, players, line };
  });
  if (!ended) return false;
  deps.duels.abort(gameId);
  const { players, line } = ended;
  if (line) publishMessage(deps, [players[0]!.userId, players[1]!.userId], line);
  const winner = players.find((p) => p.userId === winnerId);
  for (const p of players) {
    deps.hub.publish(p.userId, {
      type: "game.ended",
      gameId,
      winner: winner?.username ?? null,
      reason,
      scores: players.map((q) => ({ username: q.username, score: q.score })),
      ...extra,
    });
  }
  return true;
}

/** Ends an active مشاعره game whose turn has run out, with the other player as winner. True when it ended. */
export async function endIfOverdue(deps: Deps, game: GameRow, players: PlayerRow[]): Promise<boolean> {
  if (game.kind !== "mosh" || game.status !== "active" || deps.now() <= deadlineOf(game)) return false;
  const winner = players.find((p) => p.seat !== turnSeatOf(players));
  return endGame(deps, game.id, winner?.userId ?? null, "timeout");
}

/** Ends every مشاعره game whose turn has run out, and the duels nobody runs. Runs every 30 seconds; reads and moves also check the مشاعره game they touch. Returns how many ended. */
export async function sweepGames(deps: Deps): Promise<number> {
  const due = await deps.db
    .select()
    .from(games)
    .where(and(eq(games.status, "active"), eq(games.kind, "mosh"), sql`${games.turnStartedAt} + ${games.turnSeconds} * interval '1 second' < ${deps.now().toISOString()}::timestamptz`));
  const players = await playersOf(deps.db, due.map((g) => g.id));
  let ended = 0;
  for (const game of due) if (await endIfOverdue(deps, game, players.get(game.id)!)) ended++;
  // A duel nobody runs (the server restarted while it was on) is ended without a winner, unless it only just started.
  const lost = await deps.db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.status, "active"), eq(games.kind, "duel"), lt(games.startedAt, new Date(deps.now().getTime() - ORPHAN_DUEL_MS))));
  for (const { id } of lost) if (!deps.duels.has(id) && (await endGame(deps, id, null, "left"))) ended++;
  return ended;
}
