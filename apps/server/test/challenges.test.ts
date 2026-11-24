import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { challengeResults, challenges } from "../src/db/schema.js";
import type { LiveEvent } from "../src/hub.js";
import { sweepChallenges } from "../src/routes/challenges.js";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
type User = { token: string; id: string; username: string };

beforeEach(async () => {
  h = await makeHarness();
});

const keys = (poet = "saadi", n = 10) => Array.from({ length: n }, (_, i) => `/${poet}/golestan/sh${i + 1}#0`);
const post = (user: User | undefined, path: string, json?: unknown, headers?: HeadersInit) => h.request(path, { method: "POST", token: user?.token, json, headers });
const get = (user: User | undefined, path: string) => h.request(path, { token: user?.token });
const create = async (user: User, body: Record<string, unknown> = {}) => {
  const res = await post(user, "/v1/challenges", { game: "jigsaw", items: keys(), score: 8, seconds: 102, ...body });
  expect(res.status).toBe(201);
  return (await res.json()) as { code: string; url: string };
};
const events = (user: User) => {
  const list: LiveEvent[] = [];
  h.deps.hub.add(user.id, (e) => list.push(e));
  return list;
};
const later = (ms: number) => (h.clock.time = new Date(h.clock.time.getTime() + ms));
type Mine = { items: { code: string; label: string | null; results: { name: string; username: string | null; score: number; seconds: number }[] }[] };

describe("POST /v1/challenges", () => {
  it("makes a challenge with a four-character code and the link, valid for 30 days", async () => {
    const niloofar = await h.signUp("niloofar");
    const { code, url } = await create(niloofar);
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(url).toBe(`https://yebeyt.com/c/${code}`);
    const [row] = await h.db.select().from(challenges);
    expect(row).toMatchObject({ code, game: "jigsaw", creatorId: niloofar.id, score: 8, seconds: 102, items: keys() });
    expect(row!.expiresAt.getTime() - row!.createdAt.getTime()).toBe(30 * 86_400_000);
  });

  it("takes only ten different couplet keys and sane numbers", async () => {
    const ali = await h.signUp("ali");
    const bad = (extra: Record<string, unknown>) => post(ali, "/v1/challenges", { game: "poet", items: keys(), score: 5, seconds: 60, ...extra });
    for (const extra of [{ items: keys("saadi", 9) }, { items: keys("saadi", 11) }, { items: [...keys("saadi", 9), "/saadi/golestan/sh1#0"] }, { items: [...keys("saadi", 9), "nonsense"] }, { score: 11 }, { score: -1 }, { score: 1.5 }, { seconds: -1 }, { seconds: 3601 }, { game: "match" }, { extra: 1 }]) {
      expect((await bad(extra)).status, JSON.stringify(extra).slice(0, 40)).toBe(400);
    }
    expect((await bad({})).status).toBe(201);
  });

  it("needs a signed-in user with a username", async () => {
    expect((await post(undefined, "/v1/challenges", { game: "jigsaw", items: keys(), score: 8, seconds: 5 })).status).toBe(401);
    const bare = await h.signIn("nameless");
    const res = await h.request("/v1/challenges", { method: "POST", token: bare.accessToken, json: { game: "jigsaw", items: keys(), score: 8, seconds: 5 } });
    expect([res.status, (await res.json()) as unknown]).toEqual([403, { error: "username_required" }]);
  });

  it("allows 30 an hour", async () => {
    const ali = await h.signUp("ali");
    for (let i = 0; i < 30; i++) await create(ali);
    expect((await post(ali, "/v1/challenges", { game: "jigsaw", items: keys(), score: 8, seconds: 5 })).status).toBe(429);
  });
});

describe("GET /v1/challenges/{code}", () => {
  it("is open to anyone and tells who made it, the couplets, the score and a label", async () => {
    const niloofar = await h.signUp("niloofar", { displayName: "نیلوفر" });
    const { code } = await create(niloofar);
    const res = await get(undefined, `/v1/challenges/${code}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ creator: { username: "niloofar", displayName: "نیلوفر", avatar: null }, game: "jigsaw", items: keys(), score: 8, seconds: 102, label: "۱۰ بیت سعدی" });
  });

  it("reads the code in any case, with o as 0 and l as 1", async () => {
    const ali = await h.signUp("ali");
    const { code } = await create(ali);
    expect((await get(undefined, `/v1/challenges/${code.toLowerCase().replaceAll("0", "o").replaceAll("1", "l")}`)).status).toBe(200);
  });

  it("has no label when the poets differ or the poet is not known", async () => {
    const ali = await h.signUp("ali");
    const mixed = await create(ali, { items: [...keys("saadi", 9), "/hafez/ghazal/sh1#0"] });
    const unknown = await create(ali, { items: keys("nobodyknown") });
    expect(((await (await get(undefined, `/v1/challenges/${mixed.code}`)).json()) as { label: unknown }).label).toBeNull();
    expect(((await (await get(undefined, `/v1/challenges/${unknown.code}`)).json()) as { label: unknown }).label).toBeNull();
  });

  it("labels a poet's name in the poet's own short form", async () => {
    const ali = await h.signUp("ali");
    const { code } = await create(ali, { game: "poet", items: keys("hafez") });
    expect(((await (await get(undefined, `/v1/challenges/${code}`)).json()) as { label: string }).label).toBe("۱۰ بیت حافظ");
  });

  it("is 404 for an unknown code, a code that is not a code, and a challenge that expired", async () => {
    const ali = await h.signUp("ali");
    const { code } = await create(ali);
    expect((await get(undefined, "/v1/challenges/ZZZZ")).status).toBe(404);
    expect((await get(undefined, "/v1/challenges/zz")).status).toBe(400);
    later(31 * 86_400_000);
    expect((await get(undefined, `/v1/challenges/${code}`)).status).toBe(404);
  });
});

describe("POST /v1/challenges/{code}/results", () => {
  it("takes a guest's name and score without an account, and tells the maker live", async () => {
    const niloofar = await h.signUp("niloofar");
    const { code } = await create(niloofar);
    const live = events(niloofar);
    const res = await post(undefined, `/v1/challenges/${code}/results`, { score: 6, seconds: 90, name: "  کیان " });
    expect(res.status).toBe(201);
    const [row] = await h.db.select().from(challengeResults);
    expect(row).toMatchObject({ userId: null, name: "کیان", score: 6, seconds: 90 });
    expect(live).toEqual([{ type: "challenge.result", code, game: "jigsaw", result: { name: "کیان", username: null, score: 6, seconds: 90 } }]);
  });

  it("needs a good name without an account: 1 to 30 characters, no control characters", async () => {
    const niloofar = await h.signUp("niloofar");
    const { code } = await create(niloofar);
    const send = (name?: string) => post(undefined, `/v1/challenges/${code}/results`, { score: 1, seconds: 1, ...(name === undefined ? {} : { name }) });
    for (const name of [undefined, "", "   ", "x".repeat(31), "a\nb"]) expect((await send(name)).status, String(name)).toBe(400);
    expect((await send("x".repeat(30))).status).toBe(201);
  });

  it("refuses a score out of range, a time out of range and extra fields", async () => {
    const niloofar = await h.signUp("niloofar");
    const { code } = await create(niloofar);
    for (const body of [{ score: 11, seconds: 1, name: "a" }, { score: -1, seconds: 1, name: "a" }, { score: 1, seconds: -1, name: "a" }, { score: 1, seconds: 1, name: "a", x: 1 }]) {
      expect((await post(undefined, `/v1/challenges/${code}/results`, body)).status).toBe(400);
    }
  });

  it("is 404 for an unknown or expired challenge", async () => {
    const niloofar = await h.signUp("niloofar");
    const { code } = await create(niloofar);
    expect((await post(undefined, "/v1/challenges/ZZZZ/results", { score: 1, seconds: 1, name: "a" })).status).toBe(404);
    later(31 * 86_400_000);
    expect((await post(undefined, `/v1/challenges/${code}/results`, { score: 1, seconds: 1, name: "a" })).status).toBe(404);
  });

  it("is the person's own result when signed in, one per person, and tells the maker live and in the chat", async () => {
    const niloofar = await h.signUp("niloofar");
    const sara = await h.signUp("sara", { displayName: "سارا" });
    const { code } = await create(niloofar);
    const live = events(niloofar);
    const res = await post(sara, `/v1/challenges/${code}/results`, { score: 9, seconds: 70, name: "ignored" });
    expect(res.status).toBe(201);
    const [row] = await h.db.select().from(challengeResults);
    expect(row).toMatchObject({ userId: sara.id, name: null, score: 9, seconds: 70 });
    expect(live.map((e) => e.type)).toEqual(["challenge.result", "message"]);
    expect(live[0]).toMatchObject({ result: { name: "سارا", username: "sara", score: 9, seconds: 70 } });
    expect(live[1]).toMatchObject({ message: { kind: "game", fromMe: false, payload: { event: "challenge_result", code, game: "jigsaw", score: 9, seconds: 70 } } });
    const chats = (await (await get(niloofar, "/v1/conversations")).json()) as { items: { id: string; unread: number }[] };
    expect(chats.items[0]!.unread).toBe(1);
    expect((await post(sara, `/v1/challenges/${code}/results`, { score: 10, seconds: 60 })).status).toBe(409);
  });

  it("is not for the maker of the challenge", async () => {
    const niloofar = await h.signUp("niloofar");
    const { code } = await create(niloofar);
    expect((await post(niloofar, `/v1/challenges/${code}/results`, { score: 10, seconds: 1 })).status).toBe(409);
  });

  it("tells nobody when the two blocked each other, but keeps the result out of the maker's list", async () => {
    const niloofar = await h.signUp("niloofar");
    const sara = await h.signUp("sara");
    const { code } = await create(niloofar);
    await h.request(`/v1/blocks/${sara.username}`, { method: "PUT", token: niloofar.token });
    const live = events(niloofar);
    expect((await post(sara, `/v1/challenges/${code}/results`, { score: 9, seconds: 70 })).status).toBe(201);
    expect(live).toEqual([]);
    expect(((await (await get(niloofar, "/v1/me/challenges")).json()) as Mine).items[0]!.results).toEqual([]);
  });

  it("is rate limited: 60 an hour for a user, 120 an hour for all guests together", async () => {
    const niloofar = await h.signUp("niloofar");
    const { code } = await create(niloofar);
    for (let i = 0; i < 120; i++) expect((await post(undefined, `/v1/challenges/${code}/results`, { score: 1, seconds: 1, name: `g${i}` })).status).toBe(201);
    expect((await post(undefined, `/v1/challenges/${code}/results`, { score: 1, seconds: 1, name: "late" })).status).toBe(429);
    const sara = await h.signUp("sara");
    expect((await post(sara, `/v1/challenges/${code}/results`, { score: 1, seconds: 1 })).status).toBe(201); // users have their own budget
  });

  it("is 401 when a token is sent and it is not valid, and treats a user without a username as a guest", async () => {
    const niloofar = await h.signUp("niloofar");
    const { code } = await create(niloofar);
    expect((await post({ token: "garbage", id: "", username: "" }, `/v1/challenges/${code}/results`, { score: 1, seconds: 1, name: "a" })).status).toBe(401);
    const bare = await h.signIn("nameless");
    const asBare = { token: bare.accessToken, id: bare.user.id, username: "" };
    expect((await post(asBare, `/v1/challenges/${code}/results`, { score: 1, seconds: 1 })).status).toBe(400);
    expect((await post(asBare, `/v1/challenges/${code}/results`, { score: 1, seconds: 1, name: "بی‌نام" })).status).toBe(201);
    expect((await h.db.select().from(challengeResults))[0]).toMatchObject({ userId: null, name: "بی‌نام" });
  });
});

describe("GET /v1/me/challenges", () => {
  it("lists mine with the results, best score first then fastest, guests and people together", async () => {
    const niloofar = await h.signUp("niloofar");
    const sara = await h.signUp("sara", { displayName: "سارا" });
    const first = await create(niloofar, { items: keys("hafez"), game: "poet" });
    later(1000);
    const second = await create(niloofar);
    for (const [code, name, score, seconds] of [[second.code, "کیان", 5, 50], [second.code, "مهسا", 9, 80], [second.code, "پگاه", 9, 60]] as const) {
      await post(undefined, `/v1/challenges/${code}/results`, { score, seconds, name });
    }
    await post(sara, `/v1/challenges/${second.code}/results`, { score: 7, seconds: 40 });
    const mine = (await (await get(niloofar, "/v1/me/challenges")).json()) as Mine;
    expect(mine.items.map((c) => [c.code, c.label])).toEqual([[second.code, "۱۰ بیت سعدی"], [first.code, "۱۰ بیت حافظ"]]);
    expect(mine.items[0]!.results.map((r) => [r.name, r.username, r.score, r.seconds])).toEqual([["پگاه", null, 9, 60], ["مهسا", null, 9, 80], ["سارا", "sara", 7, 40], ["کیان", null, 5, 50]]);
    expect(mine.items[1]!.results).toEqual([]);
    expect(mine.items[0]).toMatchObject({ url: `https://yebeyt.com/c/${second.code}`, game: "jigsaw", score: 8, seconds: 102, items: keys() });
  });

  it("leaves out other people's challenges and the ones that expired, and needs a username", async () => {
    const niloofar = await h.signUp("niloofar");
    const sara = await h.signUp("sara");
    await create(niloofar);
    expect(((await (await get(sara, "/v1/me/challenges")).json()) as Mine).items).toEqual([]);
    expect((await get(undefined, "/v1/me/challenges")).status).toBe(401);
    later(31 * 86_400_000);
    const again = { ...niloofar, token: (await h.signIn("g-niloofar")).accessToken };
    expect(((await (await get(again, "/v1/me/challenges")).json()) as Mine).items).toEqual([]);
  });

  it("is cleaned up with its results once expired", async () => {
    const niloofar = await h.signUp("niloofar");
    const { code } = await create(niloofar);
    await post(undefined, `/v1/challenges/${code}/results`, { score: 1, seconds: 1, name: "a" });
    await sweepChallenges(h.deps);
    expect(await h.db.select().from(challenges)).toHaveLength(1);
    later(31 * 86_400_000);
    await sweepChallenges(h.deps);
    expect(await h.db.select().from(challenges)).toEqual([]);
    expect(await h.db.select().from(challengeResults)).toEqual([]);
    expect(await h.db.select().from(challenges).where(eq(challenges.code, code))).toEqual([]);
  });
});
