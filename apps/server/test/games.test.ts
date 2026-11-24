import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { gamePlayers, games, messages, scoreEvents } from "../src/db/schema.js";
import { CODE_ALPHABET } from "../src/codes.js";
import { sweepGames } from "../src/games.js";
import type { LiveEvent } from "../src/hub.js";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
type User = { token: string; id: string; username: string };

/** Poems the stubbed Ganjoor knows: [m1, m2] of each couplet. Each couplet starts with the letter the one before it ends with. */
const POEMS: Record<string, [string, string][]> = {
  "/t/p": [
    ["سلام بر شما", "که آمدید از راه"], // 0 ends ه
    ["هر آنکه دل دارد", "به عشق مبتلا باشد"], // 1 starts ه, ends د
    ["دگر بار آمدم", "با گل و ریحان"], // 2 starts د, ends ن
    ["نسیم صبح می‌آید", "ز سوی بوستان"], // 3 starts ن, ends ن
    ["بیا که وقت", "سحر شد ای"], // 4 starts ب
  ],
  "/t/q": [
    ["شب و روز بیدارم", "ای دوست بیا"], // 0 ends ا
    ["آمد بهار و سبزه", "نوروز آمد ماي"], // 1 starts آ, ends Arabic ي
    ["یار من", "ملك"], // 2 starts ی, ends Arabic ك
    ["کنار آب", "خانۀ"], // 3 starts ک, ends ۀ
    ["هر چه", "بیا"], // 4 starts ه
  ],
};
const verses = (couplets: [string, string][]) =>
  couplets.flatMap(([m1, m2], i) => [
    { VOrder: 2 * i, Position: "Right", Text: m1, CoupletIndex: i },
    { VOrder: 2 * i + 1, Position: "Left", Text: m2, CoupletIndex: i },
  ]);

beforeEach(async () => {
  h = await makeHarness();
  h.fetchMock.mockImplementation(async (url) => {
    const path = /\/poets(\/.*)\.json$/.exec(String(url))?.[1] ?? "";
    const poem = POEMS[path];
    return poem ? new Response(JSON.stringify({ Verses: verses(poem) })) : new Response("", { status: 404 });
  });
});

const post = (user: User | undefined, path: string, json?: unknown) => h.request(path, { method: "POST", token: user?.token, json });
const get = (user: User | undefined, path: string) => h.request(path, { token: user?.token });
const befriend = async (a: User, b: User) => {
  await h.request(`/v1/follows/${b.username}`, { method: "PUT", token: a.token });
  await h.request(`/v1/follows/${a.username}`, { method: "PUT", token: b.token });
};
type GameBody = {
  id: string; kind: string; turnSeconds: number; status: string; code: string; winner: string | null; endReason: string | null;
  players: { username: string; seat: number; score: number }[]; turn: { username: string; deadline: string } | null;
  moves: { n: number; username: string; key: string; m1: string; m2: string }[];
};
const json = async <T = GameBody>(res: Response) => (await res.json()) as T;

/** A mosh game of two people, already active. */
async function activeGame(turnSeconds = 120) {
  const ali = await h.signUp("ali");
  const sara = await h.signUp("sara");
  const created = await json<{ game: GameBody }>(await post(ali, "/v1/games", { kind: "mosh", turnSeconds }));
  expect((await post(sara, `/v1/games/${created.game.id}/join`)).status).toBe(200);
  return { ali, sara, id: created.game.id, code: created.game.code };
}
const move = (user: User, id: string, key: string) => {
  const [path, index] = key.split("#");
  const [m1, m2] = POEMS[path!]![Number(index)]!;
  return post(user, `/v1/games/${id}/moves`, { key, m1, m2 });
};
const eventsOf = (user: User) => {
  const events: LiveEvent[] = [];
  h.deps.hub.add(user.id, (e) => events.push(e));
  return events;
};

describe("POST /v1/games", () => {
  it("makes a waiting game with a four-character code and the maker in seat 0", async () => {
    const ali = await h.signUp("ali");
    const res = await post(ali, "/v1/games", { kind: "mosh", turnSeconds: 30 });
    expect(res.status).toBe(201);
    const { game, invited, skipped } = await json<{ game: GameBody; invited: string[]; skipped: unknown[] }>(res);
    expect(game).toMatchObject({ kind: "mosh", turnSeconds: 30, status: "waiting", winner: null, turn: null, moves: [], players: [{ username: "ali", seat: 0, score: 0 }] });
    expect(game.code).toMatch(new RegExp(`^[${CODE_ALPHABET}]{4}$`));
    expect(game.code).not.toMatch(/[ILOU]/);
    expect([invited, skipped]).toEqual([[], []]);
  });

  it("takes turnSeconds 30, 120 or 86400 for مشاعره, and 8 or nothing for رودررو", async () => {
    const ali = await h.signUp("ali");
    for (const turnSeconds of [30, 120, 86_400]) expect((await post(ali, "/v1/games", { kind: "mosh", turnSeconds })).status).toBe(201);
    for (const body of [{ kind: "mosh" }, { kind: "mosh", turnSeconds: 8 }, { kind: "mosh", turnSeconds: 45 }, { kind: "duel", turnSeconds: 30 }, { kind: "chess" }]) {
      expect((await post(ali, "/v1/games", body)).status).toBe(400);
    }
    expect((await json<{ game: GameBody }>(await post(ali, "/v1/games", { kind: "duel" }))).game.turnSeconds).toBe(8);
    expect((await post(ali, "/v1/games", { kind: "duel", turnSeconds: 8 })).status).toBe(201);
  });

  it("needs a signed-in user with a username", async () => {
    expect((await post(undefined, "/v1/games", { kind: "duel" })).status).toBe(401);
    const bare = await h.signIn("nameless");
    const res = await post({ token: bare.accessToken, id: bare.user.id, username: "" }, "/v1/games", { kind: "duel" });
    expect([res.status, (await res.json()) as unknown]).toEqual([403, { error: "username_required" }]);
  });

  it("allows 20 games an hour", async () => {
    const ali = await h.signUp("ali");
    for (let i = 0; i < 20; i++) expect((await post(ali, "/v1/games", { kind: "duel" })).status).toBe(201);
    expect((await post(ali, "/v1/games", { kind: "duel" })).status).toBe(429);
    h.clock.time = new Date(h.clock.time.getTime() + 3_600_001);
    const later = { ...ali, token: (await h.signIn("g-ali")).accessToken };
    expect((await post(later, "/v1/games", { kind: "duel" })).status).toBe(201);
  });

  it("makes game codes that are all different", async () => {
    const ali = await h.signUp("ali");
    const codes = new Set<string>();
    for (let i = 0; i < 15; i++) codes.add((await json<{ game: GameBody }>(await post(ali, "/v1/games", { kind: "duel" }))).game.code);
    expect(codes.size).toBe(15);
  });
});

describe("invitations", () => {
  it("become game messages in the chat, with {gameId, kind, code}", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const events = eventsOf(sara);
    const { game, invited } = await json<{ game: GameBody; invited: string[] }>(await post(ali, "/v1/games", { kind: "mosh", turnSeconds: 120, invite: ["sara"] }));
    expect(invited).toEqual(["sara"]);
    const chats = await json<{ items: { id: string }[] }>(await get(sara, "/v1/conversations"));
    const list = await json<{ items: { kind: string; fromMe: boolean; payload: Record<string, unknown> }[] }>(await get(sara, `/v1/conversations/${chats.items[0]!.id}/messages`));
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ kind: "game", fromMe: false, payload: { gameId: game.id, kind: "mosh", code: game.code } });
    expect(events.map((e) => e.type)).toEqual(["message"]);
  });

  it("skip and name people who cannot be invited", async () => {
    const ali = await h.signUp("ali");
    const friendsOnly = await h.signUp("closed");
    const blocker = await h.signUp("blocker");
    const open = await h.signUp("open");
    await h.request("/v1/me/privacy", { method: "PUT", token: friendsOnly.token, json: { gameInvitesFrom: "friends" } });
    await h.request(`/v1/blocks/${ali.username}`, { method: "PUT", token: blocker.token });
    const res = await json<{ invited: string[]; skipped: { username: string; reason: string }[] }>(
      await post(ali, "/v1/games", { kind: "duel", invite: ["closed", "blocker", "nobody", "open", "OPEN"] }),
    );
    expect(res.invited).toEqual(["open"]);
    expect(res.skipped).toEqual([
      { username: "closed", reason: "friends_only" },
      { username: "blocker", reason: "not_found" },
      { username: "nobody", reason: "not_found" },
    ]);
    expect((await json<{ skipped: unknown[] }>(await post(ali, "/v1/games", { kind: "duel", invite: ["ali"] }))).skipped).toEqual([{ username: "ali", reason: "yourself" }]);
  });

  it("go through when the person takes invitations from friends and we are friends, whatever messagesFrom says", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    await befriend(ali, sara);
    await h.request("/v1/me/privacy", { method: "PUT", token: sara.token, json: { gameInvitesFrom: "friends", messagesFrom: "friends" } });
    expect((await json<{ invited: string[] }>(await post(ali, "/v1/games", { kind: "duel", invite: ["sara"] }))).invited).toEqual(["sara"]);
    await h.request("/v1/me/privacy", { method: "PUT", token: sara.token, json: { gameInvitesFrom: "all", messagesFrom: "friends" } });
    const stranger = await h.signUp("stranger");
    expect((await json<{ invited: string[] }>(await post(stranger, "/v1/games", { kind: "duel", invite: ["sara"] }))).invited).toEqual(["sara"]);
  });

  it("are at most five", async () => {
    const ali = await h.signUp("ali");
    expect((await post(ali, "/v1/games", { kind: "duel", invite: ["a1", "a2", "a3", "a4", "a5", "a6"] })).status).toBe(400);
  });
});

describe("joining", () => {
  it("is for the first to come: the game becomes active, and a third person is refused", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const reza = await h.signUp("reza");
    const aliEvents = eventsOf(ali);
    const { game } = await json<{ game: GameBody }>(await post(ali, "/v1/games", { kind: "mosh", turnSeconds: 120 }));
    const joined = await json(await post(sara, `/v1/games/${game.id}/join`));
    expect(joined).toMatchObject({ status: "active", players: [{ username: "ali", seat: 0 }, { username: "sara", seat: 1 }], turn: { username: "ali" } });
    expect(aliEvents.map((e) => e.type)).toEqual(["game.started"]);
    const refused = await post(reza, `/v1/games/${game.id}/join`);
    expect([refused.status, (await refused.json()) as unknown]).toEqual([409, { error: "game_full" }]);
  });

  it("works by code, in any case, and again for someone already in", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const { game } = await json<{ game: GameBody }>(await post(ali, "/v1/games", { kind: "duel" }));
    const typed = game.code.toLowerCase().replaceAll("0", "o").replaceAll("1", "l");
    expect((await post(sara, `/v1/games/by-code/${typed}/join`)).status).toBe(200);
    expect((await post(sara, `/v1/games/by-code/${game.code}/join`)).status).toBe(200);
    expect((await post(ali, `/v1/games/${game.id}/join`)).status).toBe(200);
    expect((await post(sara, "/v1/games/by-code/ZZZZ/join")).status).toBe(404);
    expect((await post(sara, "/v1/games/by-code/ILOU/join")).status).toBe(400);
    expect((await post(sara, "/v1/games/by-code/12345/join")).status).toBe(400);
  });

  it("is 404 when the maker and I blocked each other, and the seat stays free", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const reza = await h.signUp("reza");
    const { game } = await json<{ game: GameBody }>(await post(ali, "/v1/games", { kind: "duel" }));
    await h.request(`/v1/blocks/${ali.username}`, { method: "PUT", token: sara.token });
    expect((await post(sara, `/v1/games/${game.id}/join`)).status).toBe(404);
    expect((await post(reza, `/v1/games/${game.id}/join`)).status).toBe(200);
  });
});

describe("reading games", () => {
  it("shows a game to its players only", async () => {
    const { ali, sara, id } = await activeGame();
    const reza = await h.signUp("reza");
    expect((await get(ali, `/v1/games/${id}`)).status).toBe(200);
    expect((await get(sara, `/v1/games/${id}`)).status).toBe(200);
    expect((await get(reza, `/v1/games/${id}`)).status).toBe(404);
    expect((await get(undefined, `/v1/games/${id}`)).status).toBe(401);
    expect((await get(reza, `/v1/games/${crypto.randomUUID()}`)).status).toBe(404);
  });

  it("lists waiting and active games, and finished ones for 7 days", async () => {
    const { ali, sara, id } = await activeGame();
    h.clock.time = new Date(h.clock.time.getTime() + 1000);
    const waiting = (await json<{ game: GameBody }>(await post(ali, "/v1/games", { kind: "duel" }))).game;
    let list = await json<{ items: GameBody[] }>(await get(ali, "/v1/me/games"));
    expect(list.items.map((g) => [g.id, g.status])).toEqual([[waiting.id, "waiting"], [id, "active"]]);
    expect(list.items[1]).not.toHaveProperty("moves");
    expect((await json<{ items: GameBody[] }>(await get(sara, "/v1/me/games"))).items.map((g) => g.id)).toEqual([id]);

    await post(sara, `/v1/games/${id}/resign`);
    list = await json<{ items: GameBody[] }>(await get(ali, "/v1/me/games"));
    expect(list.items.map((g) => g.status)).toEqual(["waiting", "done"]);
    h.clock.time = new Date(h.clock.time.getTime() + 8 * 86_400_000);
    const later = { ...ali, token: (await h.signIn("g-ali")).accessToken };
    expect((await json<{ items: GameBody[] }>(await get(later, "/v1/me/games"))).items.map((g) => g.id)).toEqual([waiting.id]);
  });

  it("ends an overdue game when the list is read", async () => {
    const { ali, id } = await activeGame(30);
    h.clock.time = new Date(h.clock.time.getTime() + 31_000);
    const list = await json<{ items: GameBody[] }>(await get(ali, "/v1/me/games"));
    expect(list.items[0]).toMatchObject({ id, status: "done", winner: "sara", endReason: "timeout" });
  });
});

describe("POST /v1/games/{id}/moves", () => {
  it("lets the maker open with any couplet, then the turns alternate with the letter rule", async () => {
    const { ali, sara, id } = await activeGame();
    const aliEvents = eventsOf(ali);
    const saraEvents = eventsOf(sara);
    let res = await move(ali, id, "/t/p#0");
    expect(res.status).toBe(200);
    const after = await json(res);
    expect(after).toMatchObject({ players: [{ username: "ali", score: 1 }, { username: "sara", score: 0 }], turn: { username: "sara" }, moves: [{ n: 1, username: "ali", key: "/t/p#0", m1: "سلام بر شما", m2: "که آمدید از راه" }] });
    expect(after.turn!.deadline).toBe(new Date(h.clock.time.getTime() + 120_000).toISOString());
    expect((await move(sara, id, "/t/p#1")).status).toBe(200);
    expect((await move(ali, id, "/t/p#2")).status).toBe(200);
    res = await move(sara, id, "/t/p#3");
    expect((await json(res)).players.map((p) => p.score)).toEqual([2, 2]);
    for (const events of [aliEvents, saraEvents]) {
      expect(events.map((e) => e.type)).toEqual(["game.move", "game.turn", "game.move", "game.turn", "game.move", "game.turn", "game.move", "game.turn"]);
      expect(events[0]).toMatchObject({ gameId: id, move: { n: 1, username: "ali", key: "/t/p#0" }, scores: [{ username: "ali", score: 1 }, { username: "sara", score: 0 }] });
      expect(events[1]).toMatchObject({ gameId: id, username: "sara" });
    }
  });

  it("refuses a move out of turn, before the game is active, or after it is done", async () => {
    const { ali, sara, id } = await activeGame();
    const out = await move(sara, id, "/t/p#0");
    expect([out.status, (await out.json()) as unknown]).toEqual([409, { error: "not_your_turn" }]);
    const waiting = (await json<{ game: GameBody }>(await post(ali, "/v1/games", { kind: "mosh", turnSeconds: 30 }))).game;
    expect(await (await move(ali, waiting.id, "/t/p#0")).json()).toEqual({ error: "game_not_active" });
    await post(ali, `/v1/games/${id}/resign`);
    expect(await (await move(ali, id, "/t/p#0")).json()).toEqual({ error: "game_not_active" });
  });

  it("refuses a duel game and a stranger", async () => {
    const ali = await h.signUp("ali");
    const reza = await h.signUp("reza");
    const { game } = await json<{ game: GameBody }>(await post(ali, "/v1/games", { kind: "duel" }));
    expect((await move(ali, game.id, "/t/p#0")).status).toBe(400);
    expect((await move(reza, game.id, "/t/p#0")).status).toBe(404);
  });

  it("refuses a couplet that does not start with the last letter of the one before, and a repeat, and lets the same player try again", async () => {
    const { ali, sara, id } = await activeGame();
    await move(ali, id, "/t/p#0"); // ends ه
    expect(await (await move(sara, id, "/t/p#4")).json()).toEqual({ error: "wrong_letter" }); // starts ب
    expect(await (await move(sara, id, "/t/p#0")).json()).toEqual({ error: "already_played" });
    expect((await move(sara, id, "/t/p#1")).status).toBe(200);
    expect((await move(ali, id, "/t/p#1")).status).toBe(409); // not my turn: no state changed by the failures
  });

  it("matches letters without diacritics: آ with ا, ي with ی, ك with ک, ۀ with ه", async () => {
    const { ali, sara, id } = await activeGame();
    for (const [i, user] of [ali, sara, ali, sara, ali].entries()) expect((await move(user, id, `/t/q#${i}`)).status, `couplet ${i}`).toBe(200);
  });

  it("checks the text against Ganjoor's, ignoring diacritics, punctuation and Arabic forms", async () => {
    const { ali, id } = await activeGame();
    const ok = await post(ali, `/v1/games/${id}/moves`, { key: "/t/p#1", m1: "هَر آنكه، دل دارد!", m2: "به عشق مبتلا باشد" });
    expect(ok.status).toBe(200);
    const stored = (await json(ok)).moves[0]!;
    expect([stored.m1, stored.m2]).toEqual(POEMS["/t/p"]![1]); // Ganjoor's own text is kept
  });

  it("refuses text that is not the couplet's, a key that is not a couplet, and a poem that does not exist", async () => {
    const { ali, id } = await activeGame();
    const bad = (body: unknown) => post(ali, `/v1/games/${id}/moves`, body);
    expect(await (await bad({ key: "/t/p#0", m1: "یه چیز دیگه", m2: "که آمدید از راه" })).json()).toEqual({ error: "bad_couplet" });
    expect(await (await bad({ key: "/t/p#1", m1: "سلام بر شما", m2: "که آمدید از راه" })).json()).toEqual({ error: "bad_couplet" });
    expect(await (await bad({ key: "/t/p#99", m1: "الف", m2: "ب" })).json()).toEqual({ error: "bad_couplet" });
    expect(await (await bad({ key: "/nobody/none#0", m1: "الف", m2: "ب" })).json()).toEqual({ error: "bad_couplet" });
    expect((await bad({ key: "nonsense", m1: "الف", m2: "ب" })).status).toBe(400);
    expect((await bad({ key: "/t/p#0", m1: "", m2: "ب" })).status).toBe(400);
    expect((await json((await get(ali, `/v1/games/${id}`)))).moves).toEqual([]);
  });

  it("is 503 unavailable when Ganjoor cannot be reached, and nothing is played", async () => {
    const { ali, id } = await activeGame();
    h.fetchMock.mockRejectedValue(new Error("offline"));
    const res = await post(ali, `/v1/games/${id}/moves`, { key: "/t/zz#0", m1: "الف", m2: "ب" });
    expect([res.status, (await res.json()) as unknown]).toEqual([503, { error: "unavailable" }]);
  });

  it("ends the game with the other as winner when the turn is over: 409 turn_over", async () => {
    const { ali, sara, id } = await activeGame(30);
    const aliEvents = eventsOf(ali);
    await move(ali, id, "/t/p#0");
    h.clock.time = new Date(h.clock.time.getTime() + 31_000); // sara's 30 s are up
    const late = await move(sara, id, "/t/p#1");
    expect([late.status, (await late.json()) as unknown]).toEqual([409, { error: "turn_over" }]);
    expect(await json(await get(ali, `/v1/games/${id}`))).toMatchObject({ status: "done", winner: "ali", endReason: "timeout" });
    expect(aliEvents.at(-1)).toMatchObject({ type: "game.ended", gameId: id, winner: "ali", reason: "timeout", scores: [{ username: "ali", score: 1 }, { username: "sara", score: 0 }] });
  });

  it("counts the deadline from the last move, and from the start for the first turn", async () => {
    const { ali, sara, id } = await activeGame(30);
    h.clock.time = new Date(h.clock.time.getTime() + 29_000);
    expect((await move(ali, id, "/t/p#0")).status).toBe(200);
    h.clock.time = new Date(h.clock.time.getTime() + 29_000); // 58 s after the start, 29 after the move
    expect((await move(sara, id, "/t/p#1")).status).toBe(200);
  });

  it("ends the game when the one who waits asks after the other's time ran out: the one who waited wins", async () => {
    const { ali, sara, id } = await activeGame(30);
    h.clock.time = new Date(h.clock.time.getTime() + 31_000); // ali never opened
    const res = await move(ali, id, "/t/p#0");
    expect(res.status).toBe(409);
    expect(await json(await get(sara, `/v1/games/${id}`))).toMatchObject({ status: "done", winner: "sara" });
  });
});

describe("ending a game", () => {
  it("«کم آوردم»: resigning gives the win to the other, scores the league, and writes a system line in the chat", async () => {
    const { ali, sara, id } = await activeGame();
    await move(ali, id, "/t/p#0");
    await move(sara, id, "/t/p#1");
    await move(ali, id, "/t/p#2");
    const saraEvents = eventsOf(sara);
    const res = await post(ali, `/v1/games/${id}/resign`);
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ status: "done", winner: "sara", endReason: "resigned" });
    const points = await h.db.select({ userId: scoreEvents.userId, game: scoreEvents.game, points: scoreEvents.points }).from(scoreEvents);
    expect(points.sort((a, b) => a.points - b.points)).toEqual([
      { userId: sara.id, game: "mosh", points: 10 },
      { userId: ali.id, game: "mosh", points: 20 },
    ]);
    const chats = await json<{ items: { id: string }[] }>(await get(sara, "/v1/conversations"));
    const list = await json<{ items: { kind: string; fromMe: boolean; payload: Record<string, unknown> }[] }>(await get(sara, `/v1/conversations/${chats.items[0]!.id}/messages`));
    expect(list.items[0]).toMatchObject({ kind: "system", fromMe: true, payload: { event: "game_ended", gameId: id, kind: "mosh", reason: "resigned" } });
    expect(saraEvents.map((e) => e.type)).toEqual(["message", "game.ended"]);
    expect((await post(ali, `/v1/games/${id}/resign`)).status).toBe(409);
  });

  it("can be resigned out of turn but not while waiting, and not by a stranger", async () => {
    const { sara, id } = await activeGame();
    const reza = await h.signUp("reza");
    expect((await post(reza, `/v1/games/${id}/resign`)).status).toBe(404);
    expect((await post(sara, `/v1/games/${id}/resign`)).status).toBe(200);
    const ali = await h.signUp("ali2");
    const waiting = (await json<{ game: GameBody }>(await post(ali, "/v1/games", { kind: "mosh", turnSeconds: 30 }))).game;
    expect((await post(ali, `/v1/games/${waiting.id}/resign`)).status).toBe(409);
  });

  it("caps the league points of a مشاعره game at 400", async () => {
    const { ali, id } = await activeGame();
    await h.db.update(gamePlayers).set({ score: 55 }).where(and(eq(gamePlayers.gameId, id), eq(gamePlayers.userId, ali.id)));
    await post(ali, `/v1/games/${id}/resign`);
    const [row] = await h.db.select({ points: scoreEvents.points }).from(scoreEvents).where(eq(scoreEvents.userId, ali.id));
    expect(row!.points).toBe(400);
  });

  it("gives no league points for a game with no couplet played", async () => {
    const { ali, id } = await activeGame();
    await post(ali, `/v1/games/${id}/resign`);
    expect(await h.db.select().from(scoreEvents)).toEqual([]);
  });

  it("is done once even when two things end it together", async () => {
    const { ali, sara, id } = await activeGame();
    await move(ali, id, "/t/p#0");
    const results = await Promise.all([post(ali, `/v1/games/${id}/resign`), post(sara, `/v1/games/${id}/resign`)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await h.db.select().from(scoreEvents)).toHaveLength(1);
    expect(await h.db.select().from(messages).where(eq(messages.kind, "system"))).toHaveLength(1);
  });

  it("the sweeper ends overdue games and leaves the others", async () => {
    const a = await activeGame(30);
    const b = await activeGame(86_400);
    h.clock.time = new Date(h.clock.time.getTime() + 60_000);
    expect(await sweepGames(h.deps)).toBe(1);
    expect(await sweepGames(h.deps)).toBe(0);
    const rows = await h.db.select({ id: games.id, status: games.status, winnerId: games.winnerId }).from(games);
    expect(rows.find((r) => r.id === a.id)).toMatchObject({ status: "done", winnerId: a.sara.id });
    expect(rows.find((r) => r.id === b.id)).toMatchObject({ status: "active" });
  });
});
