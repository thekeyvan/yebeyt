import { randomInt } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { messages, users } from "./db/schema.js";
import type { Deps } from "./deps.js";
import { publishMessage } from "./messaging.js";
import { createRateLimiter } from "./rateLimit.js";
import { isBlocked } from "./social.js";

/**
 * The couplets «یه بیت» answers with: well-known ones of the game deck (`games.json`, the file `src/gameData.ts` reads), so each key is one
 * the phone can show. test/house.test.ts checks that every key is in the deck.
 */
export const HOUSE_COUPLETS = [
  "/hafez/ghazal/sh3#0",
  "/hafez/ghazal/sh3#1",
  "/hafez/ghazal/sh1#0",
  "/hafez/ghazal/sh1#2",
  "/hafez/ghazal/sh2#0",
  "/hafez/ghazal/sh255#0",
  "/hafez/ghazal/sh255#1",
  "/hafez/ghazal/sh11#2",
  "/hafez/ghazal/sh33#0",
  "/hafez/ghazal/sh24#1",
  "/hafez/ghazal/sh53#0",
  "/hafez/ghazal/sh259#0",
  "/hafez/ghazal/sh122#0",
  "/hafez/ghazal/sh122#1",
  "/hafez/ghazal/sh165#0",
  "/hafez/ghazal/sh232#1",
  "/hafez/ghazal/sh9#4",
  "/saadi/divan/ghazals/sh12#0",
  "/saadi/divan/ghazals/sh60#1",
  "/saadi/divan/ghazals/sh48#5",
  "/saadi/divan/ghazals/sh65#0",
  "/saadi/divan/ghazals/sh105#4",
  "/saadi/divan/ghazals/sh49#3",
  "/moulavi/masnavi/daftar1/sh1#1",
  "/moulavi/shams/ghazalsh/sh1#0",
  "/moulavi/shams/ghazalsh/sh553#0",
  "/khayyam/robaee/sh1#1",
  "/khayyam/robaee/sh4#0",
  "/ferdousi/shahname/aghaz/sh1#0",
  "/ferdousi/shahname/aghaz/sh2#1",
] as const;

/** At most one reply to a person in this time, and this many a day; past that «یه بیت» says nothing. */
export const REPLY_GAP_MS = 2000;
export const REPLIES_PER_DAY = 30;

export type House = {
  /** Called after a message of `from` was saved in a chat with `to`. Does nothing unless `to` is «یه بیت»; never throws. */
  onMessage: (conversationId: string, from: string, to: string) => Promise<void>;
};

type Options = {
  /** Runs `run` after `ms`. Production: a timer that does not keep the process alive. Tests collect the calls and run them. */
  later?: (run: () => Promise<void>, ms: number) => void;
  /** How long a reply waits: one to two seconds. */
  delayMs?: () => number;
  /** A number from 0 to `n - 1`. */
  pick?: (n: number) => number;
};

/**
 * The demo friend «یه بیت» (the user with `users.is_house`, made by a migration; nobody can sign in as it). A friend request to it is accepted
 * at once (routes/friends.ts). A message to it gets one couplet back after one to two seconds, through the normal message path, so live delivery
 * and unread counts work. The replies are not a feature of the app: they let App Review (and a new user) try friends, chat, report and block alone.
 * The counts are kept in memory, like the other limits. A reply runs outside any request, so a failure is logged and dropped.
 */
export function createHouse(deps: Deps, options: Options = {}): House {
  const { db } = deps;
  const later = options.later ?? ((run, ms) => void setTimeout(() => void run(), ms).unref());
  const delayMs = options.delayMs ?? (() => 1000 + randomInt(1001));
  const pick = options.pick ?? randomInt;
  const gap = createRateLimiter(1, REPLY_GAP_MS, deps.now);
  const daily = createRateLimiter(REPLIES_PER_DAY, 86_400_000, deps.now);

  async function reply(conversationId: string, userId: string, houseId: string) {
    try {
      if (await isBlocked(db, userId, houseId)) return;
      const [previous] = await db
        .select({ key: messages.coupletKey })
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), eq(messages.senderId, houseId)))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(1);
      const choices = HOUSE_COUPLETS.filter((key) => key !== previous?.key);
      const [row] = await db
        .insert(messages)
        .values({ conversationId, senderId: houseId, kind: "couplet", coupletKey: choices[pick(choices.length)]!, createdAt: deps.now() })
        .returning();
      publishMessage(deps, [houseId, userId], row!);
    } catch {
      deps.log("house reply failed");
    }
  }

  return {
    async onMessage(conversationId, from, to) {
      try {
        const [house] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, to), eq(users.isHouse, true)));
        if (!house || !gap.fits(from, 1) || !daily.fits(from, 1)) return;
        gap.spend(from, 1);
        daily.spend(from, 1);
        later(() => reply(conversationId, from, house.id), delayMs());
      } catch {
        deps.log("house reply failed");
      }
    },
  };
}
