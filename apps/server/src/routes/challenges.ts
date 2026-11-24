import { createRoute, z } from "@hono/zod-openapi";
import { and, asc, desc, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { newCode, normalizeCode } from "../codes.js";
import { isUniqueViolation } from "../db/index.js";
import { challengeResults, challenges, messages, users } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError, errorResponse } from "../errors.js";
import { getOrCreateConversation, publishMessage } from "../messaging.js";
import { optionalUser } from "../middleware.js";
import { shortPersonSchema } from "../people.js";
import { displayNameProblem, normalizeDisplayName } from "../profile.js";
import { createRateLimiter } from "../rateLimit.js";
import { newRouter } from "../router.js";
import { coupletKeySchema } from "../schemas.js";
import { isBlocked, notBlockedWith } from "../social.js";

const security = [{ bearerAuth: [] }];
/** An empty requirement next to bearerAuth makes signing in optional in the contract. */
const noAuth: Record<string, string[]> = {};
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
export const CHALLENGE_DAYS = 30;
export const CHALLENGE_ITEMS = 10;
const SECONDS_MAX = 3600;
const MINE_MAX = 50;

const codeParam = z.object({ code: z.string().regex(/^[0-9A-Za-z]{4}$/) });
const gameSchema = z.enum(["jigsaw", "poet"]);
const scoreSchema = z.number().int().min(0).max(CHALLENGE_ITEMS);
const secondsSchema = z.number().int().min(0).max(SECONDS_MAX);

const createBody = z
  .strictObject({
    game: gameSchema,
    items: z
      .array(coupletKeySchema)
      .length(CHALLENGE_ITEMS)
      .refine((keys) => new Set(keys).size === keys.length)
      .openapi({ description: "The ten couplet keys, in the order they were played; each must be a couplet of the game deck." }),
    score: scoreSchema.openapi({ description: "How many of the ten the creator got." }),
    seconds: secondsSchema,
  })
  .openapi("CreateChallengeRequest");
const createdSchema = z.object({ code: z.string().openapi({ example: "7KQ2" }), url: z.string().openapi({ example: "https://yebeyt.com/c/7KQ2" }) }).openapi("ChallengeCreated");
const labelSchema = z.string().nullable().openapi({ description: "«۱۰ بیت سعدی» when every couplet is by the same poet, else null." });
const challengeSchema = z
  .object({
    creator: shortPersonSchema,
    game: gameSchema,
    items: z.array(coupletKeySchema),
    score: z.number().int(),
    seconds: z.number().int(),
    label: labelSchema,
  })
  .openapi("Challenge");
const resultBody = z
  .strictObject({
    score: scoreSchema,
    seconds: secondsSchema,
    name: z.string().max(200).optional().openapi({ description: "Required without an account: 1 to 30 characters after trimming, no control characters. Ignored when signed in." }),
  })
  .openapi("ChallengeResultRequest");
const resultSchema = z
  .object({ name: z.string().openapi({ description: "The username's display name, or the name a guest left." }), username: z.string().nullable(), avatar: shortPersonSchema.shape.avatar, score: z.number().int(), seconds: z.number().int(), createdAt: z.iso.datetime() })
  .openapi("ChallengeResult");
const mineSchema = z
  .object({
    code: z.string(),
    url: z.string(),
    game: gameSchema,
    items: z.array(coupletKeySchema),
    score: z.number().int(),
    seconds: z.number().int(),
    label: labelSchema,
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    results: z.array(resultSchema).openapi({ description: "Best score first, then fastest." }),
  })
  .openapi("MyChallenge");

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const persianNumber = (n: number): string => String(n).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]!);
export const challengeUrl = (code: string) => `https://yebeyt.com/c/${code}`;

/** Deletes the challenges that expired, with their results. Runs with the game sweep. */
export async function sweepChallenges(deps: Deps): Promise<void> {
  await deps.db.delete(challenges).where(lt(challenges.expiresAt, deps.now()));
}

export function challengeRoutes(deps: Deps) {
  const app = newRouter();
  const { db } = deps;
  const creating = createRateLimiter(30, HOUR_MS, deps.now);
  const answering = createRateLimiter(60, HOUR_MS, deps.now);
  const guests = createRateLimiter(120, HOUR_MS, deps.now);
  const lookups = createRateLimiter(600, 60_000, deps.now);

  /** «۱۰ بیت سعدی» when the couplets (all of them in the deck) are by one poet. */
  const labelOf = (items: string[]): string | null => {
    const slugs = new Set(items.map((key) => deps.data.byKey.get(key)?.poet));
    const poet = slugs.size === 1 ? deps.data.poets.find((p) => p.slug === [...slugs][0]) : undefined;
    return poet ? `${persianNumber(items.length)} بیت ${poet.name}` : null;
  };

  app.use("/v1/challenges/:code/results", optionalUser(deps));

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/challenges",
      tags: ["challenges"],
      summary: "Challenge friends to the ten couplets I just played",
      description: `Makes a challenge that lasts ${CHALLENGE_DAYS} days. Share \`url\` (yebeyt.com/c/<code>, four characters); anyone can play it, with or without an account. 30 an hour per user.`,
      security,
      request: { body: { required: true, content: { "application/json": { schema: createBody } } } },
      responses: {
        201: { description: "The code and the link.", content: { "application/json": { schema: createdSchema } } },
        400: errorResponse("invalid_request: not ten different keys of couplets in the game deck, or a score or time out of range."),
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required."),
        429: errorResponse("rate_limited: 30 an hour per user."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      if (!creating.take(me)) throw new ApiError(429, "rate_limited");
      const body = c.req.valid("json");
      if (!body.items.every((key) => deps.data.byKey.has(key))) throw new ApiError(400, "invalid_request");
      const now = deps.now();
      for (let attempt = 0; ; attempt++) {
        const code = newCode();
        try {
          await db.insert(challenges).values({ code, game: body.game, creatorId: me, items: body.items, score: body.score, seconds: body.seconds, createdAt: now, expiresAt: new Date(now.getTime() + CHALLENGE_DAYS * DAY_MS) });
          return c.json({ code, url: challengeUrl(code) }, 201);
        } catch (e) {
          if (!isUniqueViolation(e) || attempt >= 9) throw e; // another challenge has that code: try another
        }
      }
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/challenges/{code}",
      tags: ["challenges"],
      summary: "A challenge, for the page and the app that open its link",
      description: "No account needed (all lookups together share 600 a minute). The code is read in any case, with O as 0 and I or L as 1. An expired or unknown code is 404.",
      security: [noAuth],
      request: { params: codeParam },
      responses: {
        200: { description: "Who made it, the couplets and their score.", content: { "application/json": { schema: challengeSchema } } },
        404: errorResponse("No such challenge, or it expired."),
        429: errorResponse("rate_limited: 600 lookups a minute for the whole server."),
      },
    }),
    async (c) => {
      if (!lookups.take("lookups")) throw new ApiError(429, "rate_limited");
      const [row] = await db
        .select({ challenge: challenges, username: users.username, displayName: users.displayName, avatar: users.avatar })
        .from(challenges)
        .innerJoin(users, eq(users.id, challenges.creatorId))
        .where(and(eq(challenges.code, normalizeCode(c.req.valid("param").code)), gt(challenges.expiresAt, deps.now())));
      if (!row) throw new ApiError(404, "not_found");
      const { challenge } = row;
      return c.json({ creator: { username: row.username!, displayName: row.displayName, avatar: row.avatar }, game: challenge.game, items: challenge.items, score: challenge.score, seconds: challenge.seconds, label: labelOf(challenge.items) }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/challenges/{code}/results",
      tags: ["challenges"],
      summary: "Leave my result on a challenge",
      description:
        "Signing in is optional. Without an account `name` is required; with one the result is mine, one per person (a second is 409 `conflict`), and the maker's own challenge cannot be answered by the maker (409 `conflict`). " +
        "The maker gets a live `challenge.result` event, and when the player has an account too (and nobody blocked the other) a `game` message `{event: \"challenge_result\", code, game, score, seconds}` in their chat. " +
        "Signed-in users may send 60 an hour; all guests together 120 an hour.",
      security: [{ bearerAuth: [] }, noAuth],
      request: { params: codeParam, body: { required: true, content: { "application/json": { schema: resultBody } } } },
      responses: {
        201: { description: "Saved.", content: { "application/json": { schema: z.object({ id: z.uuid() }).openapi("ChallengeResultSaved") } } },
        400: errorResponse("invalid_request: a score or time out of range, or no valid `name` without an account."),
        401: errorResponse("A token was sent and it is not valid."),
        404: errorResponse("No such challenge, or it expired."),
        409: errorResponse("conflict: I already left a result, or it is my own challenge."),
        429: errorResponse("rate_limited."),
      },
    }),
    async (c) => {
      const body = c.req.valid("json");
      const userId = c.req.header("authorization") ? c.get("userId") : null;
      if (!(userId ? answering.take(userId) : guests.take("guests"))) throw new ApiError(429, "rate_limited");
      const [player] = userId ? await db.select({ username: users.username, displayName: users.displayName }).from(users).where(eq(users.id, userId)) : [];
      // Someone who is signed in but has no username yet is a guest here: they leave a name.
      const asUser = userId && player?.username ? userId : null;
      const name = asUser ? null : normalizeDisplayName(body.name ?? "");
      if (name !== null && displayNameProblem(name) !== null) throw new ApiError(400, "invalid_request");

      const [challenge] = await db
        .select()
        .from(challenges)
        .where(and(eq(challenges.code, normalizeCode(c.req.valid("param").code)), gt(challenges.expiresAt, deps.now())));
      if (!challenge) throw new ApiError(404, "not_found");
      if (asUser && challenge.creatorId === asUser) throw new ApiError(409, "conflict");
      let saved;
      try {
        [saved] = await db.insert(challengeResults).values({ challengeId: challenge.id, userId: asUser, name, score: body.score, seconds: body.seconds, createdAt: deps.now() }).returning({ id: challengeResults.id });
      } catch (e) {
        if (isUniqueViolation(e)) throw new ApiError(409, "conflict");
        throw e;
      }

      const creatorId = challenge.creatorId;
      if (!(asUser && (await isBlocked(db, asUser, creatorId)))) {
        deps.hub.publish(creatorId, { type: "challenge.result", code: challenge.code, game: challenge.game, result: { name: name ?? player!.displayName ?? player!.username, username: asUser ? player!.username : null, score: body.score, seconds: body.seconds } });
        if (asUser) {
          const conversationId = await getOrCreateConversation(db, asUser, creatorId);
          const [line] = await db
            .insert(messages)
            .values({ conversationId, senderId: asUser, kind: "game", payload: { event: "challenge_result", code: challenge.code, game: challenge.game, score: body.score, seconds: body.seconds }, createdAt: deps.now() })
            .returning();
          publishMessage(deps, [asUser, creatorId], line!);
        }
      }
      return c.json({ id: saved!.id }, 201);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/me/challenges",
      tags: ["challenges"],
      summary: "My challenges with their results",
      description: `Newest first, at most ${MINE_MAX}, the ones that have not expired. Results of people I blocked or who blocked me are left out.`,
      security,
      responses: {
        200: { description: "My challenges.", content: { "application/json": { schema: z.object({ items: z.array(mineSchema) }).openapi("MyChallengeList") } } },
        401: errorResponse("Not signed in."),
        403: errorResponse("username_required."),
      },
    }),
    async (c) => {
      const me = c.get("userId");
      const mine = await db
        .select()
        .from(challenges)
        .where(and(eq(challenges.creatorId, me), gt(challenges.expiresAt, deps.now())))
        .orderBy(desc(challenges.createdAt), desc(challenges.id))
        .limit(MINE_MAX);
      const results = mine.length
        ? await db
            .select({ challengeId: challengeResults.challengeId, name: challengeResults.name, username: users.username, displayName: users.displayName, avatar: users.avatar, score: challengeResults.score, seconds: challengeResults.seconds, createdAt: challengeResults.createdAt })
            .from(challengeResults)
            .leftJoin(users, eq(users.id, challengeResults.userId))
            .where(and(inArray(challengeResults.challengeId, mine.map((m) => m.id)), or(isNull(challengeResults.userId), notBlockedWith(me, challengeResults.userId))))
            .orderBy(desc(challengeResults.score), asc(challengeResults.seconds), asc(challengeResults.createdAt))
        : [];
      return c.json(
        {
          items: mine.map((m) => ({
            code: m.code,
            url: challengeUrl(m.code),
            game: m.game,
            items: m.items,
            score: m.score,
            seconds: m.seconds,
            label: labelOf(m.items),
            createdAt: m.createdAt.toISOString(),
            expiresAt: m.expiresAt.toISOString(),
            results: results
              .filter((r) => r.challengeId === m.id)
              .map((r) => ({ name: r.name ?? r.displayName ?? r.username!, username: r.username, avatar: r.avatar, score: r.score, seconds: r.seconds, createdAt: r.createdAt.toISOString() })),
          })),
        },
        200,
      );
    },
  );

  return app;
}
