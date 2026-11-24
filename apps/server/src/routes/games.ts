import { createRoute, z } from "@hono/zod-openapi";
import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { isCode, newCode, normalizeCode } from "../codes.js";
import { isUniqueViolation } from "../db/index.js";
import { gamePlayers, games, messages, moshMoves, privacySettings } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { createGanjoor } from "../ganjoor.js";
import { deadlineOf, endGame, endIfOverdue, gameSchema, gameSummarySchema, gameView, playersOf, summaryOf, turnSeatOf } from "../games.js";
import { getOrCreateConversation, publishMessage } from "../messaging.js";
import { findByUsername, relationOf } from "../people.js";
import { firstLetter, lastLetter, normalizeText } from "../persian.js";
import { createRateLimiter } from "../rateLimit.js";
import { newRouter } from "../router.js";
import { coupletKeySchema, usernameSchema } from "../schemas.js";
import { isBlocked } from "../social.js";
import { PRIVACY_DEFAULTS } from "./privacy.js";

const security = [{ bearerAuth: [] }];
const DAY_MS = 86_400_000;
export const MOSH_TURN_SECONDS = [30, 120, 86_400] as const;
export const DUEL_ROUND_SECONDS = 8;
const INVITES_MAX = 5;
const RECENT_DAYS = 7;
const idParam = z.object({ id: z.uuid() });
const codeParam = z.object({ code: z.string().max(10).refine(isCode) });

const createBody = z
  .strictObject({
    kind: z.enum(["mosh", "duel"]),
    turnSeconds: z.union([z.literal(30), z.literal(120), z.literal(86_400), z.literal(8)]).optional().openapi({ description: "مشاعره (required): 30, 120 or 86400. رودررو: 8, or leave it out." }),
    invite: z.array(usernameSchema).max(INVITES_MAX).default([]).openapi({ description: "Up to 5 usernames to send the invitation to, in their chats." }),
  })
  .openapi("CreateGameRequest");
const createdSchema = z
  .object({
    game: gameSchema,
    invited: z.array(z.string()).openapi({ description: "The usernames that got a `game` message." }),
    skipped: z
      .array(z.object({ username: z.string(), reason: z.enum(["not_found", "friends_only", "yourself"]) }))
      .openapi({ description: "Who could not be invited. `not_found` also covers a block, which nobody is told about; `friends_only`: they take game invitations only from friends." }),
  })
  .openapi("GameCreated");
const moveBody = z.strictObject({ key: coupletKeySchema, m1: z.string().min(1).max(300), m2: z.string().min(1).max(300) }).openapi("MoshMoveRequest");

export function gameRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;
  const ganjoor = createGanjoor(deps);
  const creating = createRateLimiter(20, 3_600_000, deps.now);

  /** The game and its players if `userId` plays in it (404 otherwise). An overdue مشاعره game is ended first, unless `lazy` is false. */
  const load = async (userId: string, id: string, lazy = true) => {
    const read = async () => {
      const [game] = await db.select().from(games).where(eq(games.id, id));
      const players = game ? (await playersOf(db, [id])).get(id)! : [];
      if (!game || !players.some((p) => p.userId === userId)) throw new ApiError(404, "not_found");
      return { game, players };
    };
    const loaded = await read();
    return lazy && (await endIfOverdue(deps, loaded.game, loaded.players)) ? read() : loaded;
  };

  /** Sends the invitation to one person, or says why not. */
  const invite = async (me: string, username: string, game: { id: string; kind: string; code: string }): Promise<"invited" | "not_found" | "friends_only" | "yourself"> => {
    const other = await findByUsername(db, username);
    if (!other) return "not_found";
    if (other.id === me) return "yourself";
    if (await isBlocked(db, me, other.id)) return "not_found";
    const [settings] = await db.select({ from: privacySettings.gameInvitesFrom }).from(privacySettings).where(eq(privacySettings.userId, other.id));
    if ((settings?.from ?? PRIVACY_DEFAULTS.gameInvitesFrom) === "friends" && !(await relationOf(db, me, other.id)).isFriend) return "friends_only";
    const conversationId = await getOrCreateConversation(db, me, other.id);
    const [message] = await db
      .insert(messages)
      .values({ conversationId, senderId: me, kind: "game", payload: { event: "game_invite", gameId: game.id, kind: game.kind, code: game.code }, createdAt: deps.now() })
      .returning();
    publishMessage(deps, [me, other.id], message!);
    return "invited";
  };

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/games",
      tags: ["games"],
      summary: "Start a game with a friend",
      description:
        "Makes a game that waits for a second player (the first to join takes the seat), with a four-character `code`. Each `invite` becomes a chat message of kind `game` with payload `{gameId, kind, code}` (a chat is made if there is none, whatever their `messagesFrom` says); " +
        "a person who blocked you or whom you blocked, who has no such username, or who takes game invitations only from friends (`gameInvitesFrom`) when you are not one, is skipped and named in `skipped`. 20 games an hour per user.",
      security,
      request: { body: { required: true, content: { "application/json": { schema: createBody } } } },
      responses: {
        201: { description: "The game, who was invited and who was skipped.", content: { "application/json": { schema: createdSchema } } },
        400: errorResponse("invalid_request: مشاعره without a valid `turnSeconds`, or رودررو with one other than 8."),
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required."),
        429: errorResponse("rate_limited: 20 games an hour per user."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const body = c.req.valid("json");
      const turnSeconds = body.turnSeconds ?? (body.kind === "duel" ? DUEL_ROUND_SECONDS : undefined);
      const allowed: readonly number[] = body.kind === "duel" ? [DUEL_ROUND_SECONDS] : MOSH_TURN_SECONDS;
      if (turnSeconds === undefined || !allowed.includes(turnSeconds)) throw new ApiError(400, "invalid_request");
      if (!creating.take(me)) throw new ApiError(429, "rate_limited");

      let game;
      for (let attempt = 0; !game; attempt++) {
        try {
          game = await db.transaction(async (tx) => {
            const [row] = await tx.insert(games).values({ kind: body.kind, turnSeconds, code: newCode(), createdBy: me, createdAt: deps.now() }).returning();
            await tx.insert(gamePlayers).values({ gameId: row!.id, userId: me, seat: 0, joinedAt: deps.now() });
            return row!;
          });
        } catch (e) {
          if (!isUniqueViolation(e) || attempt >= 9) throw e; // another game has that code: try another
        }
      }
      const invited: string[] = [];
      const skipped: { username: string; reason: "not_found" | "friends_only" | "yourself" }[] = [];
      for (const username of new Set(body.invite.map((u) => u.toLowerCase()))) {
        const result = await invite(me, username, game);
        if (result === "invited") invited.push(username);
        else skipped.push({ username, reason: result });
      }
      return c.json({ game: await gameView(deps, game, (await playersOf(db, [game.id])).get(game.id)!), invited, skipped }, 201);
    },
  );

  /** Takes the free seat of a waiting game, once. */
  const join = async (me: string, gameId: string) => {
    const joined = await db.transaction(async (tx) => {
      const [game] = await tx.select().from(games).where(eq(games.id, gameId)).for("update");
      if (!game) throw new ApiError(404, "not_found");
      const players = (await playersOf(tx, [gameId])).get(gameId)!;
      if (players.some((p) => p.userId === me)) return { game, started: false };
      const creator = players.find((p) => p.seat === 0);
      if (creator && (await isBlocked(tx, me, creator.userId))) throw new ApiError(404, "not_found");
      if (game.status !== "waiting") throw new ApiError(409, "game_full");
      const now = deps.now();
      await tx.insert(gamePlayers).values({ gameId, userId: me, seat: 1, joinedAt: now });
      const [started] = await tx.update(games).set({ status: "active", startedAt: now, turnStartedAt: now }).where(eq(games.id, gameId)).returning();
      return { game: started!, started: true };
    });
    const players = (await playersOf(db, [gameId])).get(gameId)!;
    if (joined.started) {
      for (const p of players) deps.hub.publish(p.userId, { type: "game.started", game: summaryOf(joined.game, players) });
    }
    return { game: joined.game, players };
  };

  const joinResponses = {
    200: { description: "The game (also when I was already in it).", content: { "application/json": { schema: gameSchema } } },
    401: errorResponse("Not signed in."),
    403: errorResponse("username_required."),
    404: errorResponse("No such game or code, or the person who made it and I blocked each other."),
    409: errorResponse("game_full: somebody else took the seat, or the game is over."),
  };

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/games/{id}/join",
      tags: ["games"],
      summary: "Join a waiting game",
      description: "Whoever comes first takes the second seat; the game is then active (a live `game.started` event goes to both). Joining a game I am already in answers 200 and changes nothing.",
      security,
      request: { params: idParam },
      responses: joinResponses,
    }),
    async (c) => {
      const { game, players } = await join(c.get("userId"), c.req.valid("param").id);
      return c.json(await gameView(deps, game, players), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/games/by-code/{code}/join",
      tags: ["games"],
      summary: "Join a waiting game by its code",
      description: "Same as joining by id. The code is read in any case, with O as 0 and I or L as 1.",
      security,
      request: { params: codeParam },
      responses: { ...joinResponses, 400: errorResponse("invalid_request: not a game code.") },
    }),
    async (c) => {
      const [found] = await db.select({ id: games.id }).from(games).where(eq(games.code, normalizeCode(c.req.valid("param").code)));
      if (!found) throw new ApiError(404, "not_found");
      const { game, players } = await join(c.get("userId"), found.id);
      return c.json(await gameView(deps, game, players), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/games/{id}",
      tags: ["games"],
      summary: "A game I play in",
      description: "Players only (404 for anyone else). A مشاعره game whose turn has run out is ended first, with the other player as winner.",
      security,
      request: { params: idParam },
      responses: {
        200: { description: "The game with its couplets or rounds.", content: { "application/json": { schema: gameSchema } } },
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required."),
        404: errorResponse("No such game, or I am not a player."),
      },
    }),
    async (c) => {
      const { game, players } = await load(c.get("userId"), c.req.valid("param").id);
      return c.json(await gameView(deps, game, players), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/me/games",
      tags: ["games"],
      summary: "My games: waiting and active ones, and the ones that ended in the last 7 days",
      description: "Newest first, at most 50, without the couplets or rounds (read one game for those). Overdue مشاعره games are ended first.",
      security,
      responses: {
        200: { description: "The games.", content: { "application/json": { schema: z.object({ items: z.array(gameSummarySchema) }).openapi("GameList") } } },
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const since = new Date(deps.now().getTime() - RECENT_DAYS * DAY_MS);
      const mine = () =>
        db
          .select({ game: games })
          .from(games)
          .innerJoin(gamePlayers, eq(gamePlayers.gameId, games.id))
          .where(and(eq(gamePlayers.userId, me), or(inArray(games.status, ["waiting", "active"]), gte(games.endedAt, since))))
          .orderBy(desc(games.createdAt), desc(games.id))
          .limit(50);
      let rows = await mine();
      let players = await playersOf(db, rows.map((r) => r.game.id));
      let any = false;
      for (const { game } of rows) any = (await endIfOverdue(deps, game, players.get(game.id)!)) || any;
      if (any) {
        rows = await mine();
        players = await playersOf(db, rows.map((r) => r.game.id));
      }
      return c.json({ items: rows.map(({ game }) => summaryOf(game, players.get(game.id)!)) }, 200);
    },
  );

  const gameErrors = {
    400: errorResponse("invalid_request, or bad_couplet: the key is not a couplet or its text is not Ganjoor's, or the couplet has no letter to continue from."),
    401: errorResponse("Not signed in."),
    403: errorResponse("username_required."),
    404: errorResponse("No such game, or I am not a player."),
  };

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/games/{id}/moves",
      tags: ["games"],
      summary: "Play a couplet in مشاعره",
      description:
        "My turn only. The creator opens with any couplet; each next one must start with the last letter of the previous couplet's second hemistich (letters compared without diacritics: آ as ا, ي as ی, ك as ک, ۀ and ة as ه, ئ as ی; punctuation and half-spaces skipped), and no couplet repeats in a game. " +
        "`key` is the couplet the phone matched; the server fetches that poem from Ganjoor (at the commit the app's data comes from) and checks that `m1` and `m2` are its text, ignoring diacritics, punctuation and Arabic letter forms (400 `bad_couplet`; 503 `unavailable` when Ganjoor cannot be reached). " +
        "A request after the turn's deadline (the last move, or the start, plus `turnSeconds`) ends the game with the other player as winner and answers 409 `turn_over`. " +
        "A good move is +1 for me, passes the turn, and sends live `game.move` and `game.turn` events to both players.",
      security,
      request: { params: idParam, body: { required: true, content: { "application/json": { schema: moveBody } } } },
      responses: {
        200: { description: "The game after the move.", content: { "application/json": { schema: gameSchema } } },
        ...gameErrors,
        409: errorResponse("not_your_turn, wrong_letter, already_played, turn_over (the game just ended) or game_not_active (waiting or done)."),
        503: errorResponse("unavailable: Ganjoor could not be reached."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const { id } = c.req.valid("param");
      const { key, m1, m2 } = c.req.valid("json");
      const { game, players } = await load(me, id, false);
      if (game.kind !== "mosh") throw new ApiError(400, "invalid_request");
      if (game.status !== "active") throw new ApiError(409, "game_not_active");
      if (await endIfOverdue(deps, game, players)) throw new ApiError(409, "turn_over");
      const seat = players.find((p) => p.userId === me)!.seat;
      if (seat !== turnSeatOf(players)) throw new ApiError(409, "not_your_turn");

      const real = await ganjoor.couplet(key);
      if (!real || normalizeText(real.m1) !== normalizeText(m1) || normalizeText(real.m2) !== normalizeText(m2)) throw new ApiError(400, "bad_couplet");
      const first = firstLetter(real.m1);
      if (!first || !lastLetter(real.m2)) throw new ApiError(400, "bad_couplet");

      const now = deps.now();
      const outcome = await db.transaction(async (tx) => {
        // The row lock makes two moves at once wait for each other, so the turn and the letter are checked against the latest state.
        const [current] = await tx.select().from(games).where(eq(games.id, id)).for("update");
        if (!current || current.status !== "active") return "game_not_active" as const;
        const scores = (await playersOf(tx, [id])).get(id)!;
        if (now > deadlineOf(current)) return "turn_over" as const;
        if (seat !== turnSeatOf(scores)) return "not_your_turn" as const;
        const played = await tx.select().from(moshMoves).where(eq(moshMoves.gameId, id)).orderBy(desc(moshMoves.n));
        if (played.some((m) => m.key === key)) return "already_played" as const;
        const last = played[0];
        if (last && first !== lastLetter(last.m2)) return "wrong_letter" as const;
        const [move] = await tx.insert(moshMoves).values({ gameId: id, n: (last?.n ?? 0) + 1, userId: me, key, m1: real.m1, m2: real.m2, createdAt: now }).returning();
        await tx.update(gamePlayers).set({ score: sql`${gamePlayers.score} + 1` }).where(and(eq(gamePlayers.gameId, id), eq(gamePlayers.userId, me)));
        await tx.update(games).set({ turnStartedAt: now }).where(eq(games.id, id));
        return move!;
      });
      if (typeof outcome === "string") {
        if (outcome === "turn_over") {
          const [current] = await db.select().from(games).where(eq(games.id, id));
          await endIfOverdue(deps, current!, (await playersOf(db, [id])).get(id)!);
        }
        throw new ApiError(409, outcome);
      }

      const fresh = await load(me, id);
      const view = await gameView(deps, fresh.game, fresh.players);
      const move = view.moves.at(-1)!;
      const next = view.turn!;
      for (const p of fresh.players) {
        deps.hub.publish(p.userId, { type: "game.move", gameId: id, move, scores: view.players.map((q) => ({ username: q.username, score: q.score })) });
        deps.hub.publish(p.userId, { type: "game.turn", gameId: id, username: next.username, deadline: next.deadline });
      }
      return c.json(view, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/games/{id}/resign",
      tags: ["games"],
      summary: "«کم آوردم»: give up",
      description: "Ends an active game with the other player as winner. Anytime in an active game, not only on my turn.",
      security,
      request: { params: idParam },
      responses: {
        200: { description: "The game, ended.", content: { "application/json": { schema: gameSchema } } },
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required."),
        404: errorResponse("No such game, or I am not a player."),
        409: errorResponse("game_not_active: waiting or already done."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const { id } = c.req.valid("param");
      const { game, players } = await load(me, id);
      if (game.status !== "active") throw new ApiError(409, "game_not_active");
      const other = players.find((p) => p.userId !== me)!;
      if (!(await endGame(deps, id, other.userId, "resigned"))) throw new ApiError(409, "game_not_active");
      const [ended] = await db.select().from(games).where(eq(games.id, id));
      return c.json(await gameView(deps, ended!, (await playersOf(db, [id])).get(id)!), 200);
    },
  );

  return app;
}
