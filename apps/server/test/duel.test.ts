import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { createDuels } from "../src/duel.js";
import { games, scoreEvents } from "../src/db/schema.js";
import { makeQuestions, seededGenerator, type Question } from "../src/quiz.js";
import { startServer, type RunningServer } from "../src/server.js";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
let server: RunningServer;
const sockets: WebSocket[] = [];
const SEED = 7n;
let questions: Question[];

type User = { token: string; id: string; username: string };
type Event = { type: string; [key: string]: unknown };

async function setup(timings: Parameters<typeof createDuels>[1] = {}) {
  h = await makeHarness();
  h.deps.duels = createDuels(h.deps, { seed: () => SEED, ...timings });
  server = await startServer(h.deps, 0, { authTimeoutMs: 5000, heartbeatMs: 60_000 });
  questions = makeQuestions(h.deps.data, seededGenerator(SEED));
}

beforeEach(() => setup());
afterEach(async () => {
  vi.useRealTimers();
  for (const ws of sockets.splice(0)) ws.terminate();
  await server.close();
});

/** Lets the database and the sockets finish what is under way; timers are faked in most tests, so this counts event-loop turns, not time. */
const settle = async (turns = 300) => {
  for (let i = 0; i < turns; i++) await new Promise((resolve) => setImmediate(resolve));
};

/** Waits (in event-loop turns, not time) until the condition holds. `vi.waitFor` would move the faked clock. */
const until = async (condition: () => boolean) => {
  for (let i = 0; i < 100 && !condition(); i++) await settle(10);
  expect(condition()).toBe(true);
};

/** A signed-in client: the events it gets, in order. */
async function live(user: User) {
  const ws = new WebSocket(`ws://127.0.0.1:${server.port}/v1/live`);
  sockets.push(ws);
  const queue: Event[] = [];
  const waiting: ((e: Event) => void)[] = [];
  ws.on("message", (data) => {
    const event = JSON.parse(data.toString()) as Event;
    const next = waiting.shift();
    if (next) next(event);
    else queue.push(event);
  });
  await new Promise<void>((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });
  const next = (): Promise<Event> => (queue.length ? Promise.resolve(queue.shift()!) : new Promise((resolve) => waiting.push(resolve)));
  const client = {
    ws,
    next,
    /** The next event, which must be of this type. */
    async expect(type: string) {
      const event = await next();
      expect(event.type).toBe(type);
      return event;
    },
    /** Nothing arrives (after giving what is on its way a moment to come). */
    async idle() {
      await settle();
      expect(queue).toEqual([]);
    },
    send: (value: unknown) => ws.send(JSON.stringify(value)),
  };
  client.send({ type: "auth", token: user.token });
  await client.expect("ready");
  return client;
}
type Client = Awaited<ReturnType<typeof live>>;

const post = (user: User, path: string, json?: unknown) => h.request(path, { method: "POST", token: user.token, json });
const get = (user: User, path: string) => h.request(path, { token: user.token });
const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

/** A duel of two online people. Timers are faked from here on; the game is joined and `game.started` read. */
async function startedDuel() {
  const ali = await h.signUp("ali");
  const sara = await h.signUp("sara");
  const a = await live(ali);
  const s = await live(sara);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const { game } = (await (await post(ali, "/v1/games", { kind: "duel" })).json()) as { game: { id: string } };
  expect((await post(sara, `/v1/games/${game.id}/join`)).status).toBe(200);
  await a.expect("game.started");
  await s.expect("game.started");
  return { ali, sara, a, s, id: game.id };
}

const answer = (client: Client, gameId: string, round: number, option: number) => client.send({ type: "duel.answer", gameId, round, option });
const wrongOption = (round: number) => (questions[round - 1]!.correct + 1) % questions[round - 1]!.options.length;
const rightOption = (round: number) => questions[round - 1]!.correct;

describe("a full duel over two sockets", () => {
  it("asks five questions, scores the rounds, and ends with the couplets and their meanings", async () => {
    const { ali, a, s, id } = await startedDuel();
    await advance(2999);
    await a.idle();
    await advance(1);

    // round 1: ali answers right and wins it
    for (const c of [a, s]) {
      const q = await c.expect("duel.question");
      const first = questions[0]!;
      expect(q).toMatchObject({ gameId: id, round: 1, rounds: 5, kind: first.type, options: first.options, deadlineMs: 8000 });
      expect(JSON.stringify(q)).not.toContain(first.couplet.key);
      expect(first.type === "second" ? Object.keys(q.couplet as object) : Object.keys(q.couplet as object).sort()).toEqual(first.type === "second" ? ["m1"] : ["m1", "m2"]);
    }
    answer(a, id, 1, rightOption(1));
    for (const c of [a, s]) expect(await c.expect("duel.round")).toMatchObject({ gameId: id, round: 1, winner: "ali", rightOption: rightOption(1), scores: [{ username: "ali", score: 1 }, { username: "sara", score: 0 }] });

    // round 2: both answer wrong: each is locked out, the others are told, and the round ends with nobody
    await advance(2500);
    for (const c of [a, s]) expect(await c.expect("duel.question")).toMatchObject({ round: 2 });
    answer(s, id, 2, wrongOption(2));
    for (const c of [a, s]) expect(await c.expect("duel.answered")).toEqual({ type: "duel.answered", gameId: id, round: 2, username: "sara" });
    answer(s, id, 2, rightOption(2)); // locked out: a second try does not count
    answer(a, id, 2, wrongOption(2));
    for (const c of [a, s]) {
      expect(await c.expect("duel.answered")).toMatchObject({ username: "ali" });
      expect(await c.expect("duel.round")).toMatchObject({ round: 2, winner: null, rightOption: rightOption(2) });
    }

    // round 3: nobody answers; the eight seconds run out
    await advance(2500);
    for (const c of [a, s]) await c.expect("duel.question");
    await advance(7999);
    await a.idle();
    await advance(1);
    for (const c of [a, s]) expect(await c.expect("duel.round")).toMatchObject({ round: 3, winner: null });

    // round 4: sara wrongly, then ali right after sara's wrong answer; ali wins it
    await advance(2500);
    for (const c of [a, s]) await c.expect("duel.question");
    answer(s, id, 4, wrongOption(4));
    answer(a, id, 4, rightOption(4));
    for (const c of [a, s]) {
      await c.expect("duel.answered");
      expect(await c.expect("duel.round")).toMatchObject({ round: 4, winner: "ali" });
    }

    // round 5: sara wins it; the late right answer of ali changes nothing
    await advance(2500);
    for (const c of [a, s]) await c.expect("duel.question");
    answer(s, id, 5, rightOption(5));
    answer(a, id, 5, rightOption(5));
    for (const c of [a, s]) expect(await c.expect("duel.round")).toMatchObject({ round: 5, winner: "sara", scores: [{ username: "ali", score: 2 }, { username: "sara", score: 1 }] });
    for (const c of [a, s]) {
      await c.expect("message"); // the system line in their chat
      const ended = await c.expect("game.ended");
      expect(ended).toMatchObject({ gameId: id, winner: "ali", reason: "finished", scores: [{ username: "ali", score: 2 }, { username: "sara", score: 1 }] });
      const couplets = ended.couplets as { round: number; type: string; key: string; meaning: string; winner: string | null }[];
      expect(couplets.map((x) => [x.round, x.key, x.winner])).toEqual(questions.map((q, i) => [i + 1, q.couplet.key, ["ali", null, null, "ali", "sara"][i]]));
      for (const x of couplets) expect(x.meaning.length).toBeGreaterThan(0);
    }
    await a.idle();
    await s.idle();

    // the game, the league and the chat
    const [row] = await h.db.select().from(games).where(eq(games.id, id));
    expect(row).toMatchObject({ status: "done", endReason: "finished" });
    const points = await h.db.select({ userId: scoreEvents.userId, game: scoreEvents.game, points: scoreEvents.points }).from(scoreEvents);
    expect(points.map((p) => [p.game, p.points]).sort()).toEqual([["duel", 30], ["duel", 60]]);
    const view = (await (await get(ali, `/v1/games/${id}`)).json()) as { rounds: unknown[]; status: string };
    expect(view).toMatchObject({ status: "done" });
    expect(view.rounds).toHaveLength(5);
  });

  it("stays in memory until the game is written as done, so the sweep cannot end it with no winner meanwhile", async () => {
    const { a, s, id } = await startedDuel();
    await advance(3000);
    for (let round = 1; round <= 4; round++) {
      for (const c of [a, s]) await c.expect("duel.question");
      await advance(8000);
      for (const c of [a, s]) await c.expect("duel.round");
      await advance(2500);
    }
    for (const c of [a, s]) await c.expect("duel.question");
    // from here the write that ends the game waits, as a slow database would make it
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const transaction = h.deps.db.transaction.bind(h.deps.db);
    h.deps.db.transaction = (async (...args: Parameters<typeof transaction>) => {
      await gate;
      return transaction(...args);
    }) as typeof transaction;
    answer(s, id, 5, rightOption(5));
    for (const c of [a, s]) await c.expect("duel.round");
    await settle();
    expect(h.deps.duels.has(id)).toBe(true);
    h.clock.time = new Date(h.clock.time.getTime() + 61_000);
    const { sweepGames } = await import("../src/games.js");
    expect(await sweepGames(h.deps)).toBe(0);
    release();
    for (const c of [a, s]) {
      await c.expect("message");
      expect(await c.expect("game.ended")).toMatchObject({ winner: "sara", reason: "finished" });
    }
    expect(h.deps.duels.has(id)).toBe(false);
  });

  it("is a draw (no winner) when the rounds are shared", async () => {
    const { a, s, id } = await startedDuel();
    await advance(3000);
    for (let round = 1; round <= 5; round++) {
      for (const c of [a, s]) await c.expect("duel.question");
      if (round === 1) answer(a, id, round, rightOption(round));
      else if (round === 2) answer(s, id, round, rightOption(round));
      else await advance(8000);
      for (const c of [a, s]) expect(await c.expect("duel.round")).toMatchObject({ round });
      if (round < 5) await advance(2500);
    }
    for (const c of [a, s]) {
      await c.expect("message");
      expect(await c.expect("game.ended")).toMatchObject({ winner: null, reason: "finished" });
    }
    const [row] = await h.db.select().from(games);
    expect(row).toMatchObject({ status: "done", winnerId: null });
  });

  it("ignores answers that are for another round, another game, out of range, or not valid", async () => {
    const { a, s, id } = await startedDuel();
    await advance(3000);
    for (const c of [a, s]) await c.expect("duel.question");
    answer(a, id, 2, rightOption(1)); // another round
    answer(a, crypto.randomUUID(), 1, rightOption(1)); // another game
    answer(a, id, 1, 9); // no such option
    a.send({ type: "duel.answer", gameId: id, round: "1", option: 0 });
    a.send({ type: "nonsense" });
    a.ws.send("not json");
    await advance(0);
    await a.idle();
    await s.idle();
    answer(s, id, 1, rightOption(1));
    for (const c of [a, s]) expect(await c.expect("duel.round")).toMatchObject({ round: 1, winner: "sara" });
  });

  it("does not take answers from someone who is not in the duel", async () => {
    const { a, s, id } = await startedDuel();
    const reza = await h.signUp("reza");
    const r = await live(reza);
    await advance(3000);
    for (const c of [a, s]) await c.expect("duel.question");
    answer(r, id, 1, rightOption(1));
    await advance(0);
    await a.idle();
    await r.idle();
  });
});

describe("leaving", () => {
  it("gives the win to the other when a player is away for more than 15 seconds", async () => {
    const { ali, a, s, id } = await startedDuel();
    await advance(3000);
    for (const c of [a, s]) await c.expect("duel.question");
    a.ws.terminate();
    await until(() => !h.deps.hub.isOnline(ali.id));
    await settle(); // the 15 seconds start once the server has noticed
    await advance(14_999); // the rounds go on meanwhile: round 1 runs out and round 2 is asked
    expect(await s.expect("duel.round")).toMatchObject({ round: 1, winner: null });
    await s.expect("duel.question");
    await s.idle();
    await advance(1);
    await s.expect("message");
    expect(await s.expect("game.ended")).toMatchObject({ gameId: id, winner: "sara", reason: "left" });
    const [row] = await h.db.select().from(games);
    expect(row).toMatchObject({ status: "done", endReason: "left" });
    await advance(10_000); // the round clock is gone: nothing more comes
    await s.idle();
  });

  it("goes on when the player is back within 15 seconds, and is asked the question again with the time that is left", async () => {
    const { ali, a, s, id } = await startedDuel();
    await advance(3000);
    for (const c of [a, s]) await c.expect("duel.question");
    a.ws.terminate();
    await until(() => !h.deps.hub.isOnline(ali.id));
    await settle();
    await advance(3000);
    const back = await live(ali);
    const again = await back.expect("duel.question");
    expect(again).toMatchObject({ round: 1, gameId: id });
    expect(again.deadlineMs).toBeLessThanOrEqual(8000);
    await advance(16_000); // well past 15 seconds since the socket closed
    expect(await (await get(ali, `/v1/games/${id}`)).json()).toMatchObject({ status: "active" });
  });

  it("waits for a player who is not online yet, starts when they come, and ends if they do not", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const reza = await h.signUp("reza");
    const mina = await h.signUp("mina");
    const a = await live(ali);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { game } = (await (await post(ali, "/v1/games", { kind: "duel" })).json()) as { game: { id: string } };
    await post(sara, `/v1/games/${game.id}/join`);
    await a.expect("game.started");
    await advance(10_000);
    await a.idle(); // sara is not online: no question
    const s = await live(sara);
    await advance(3000);
    await a.expect("duel.question");
    await s.expect("duel.question");

    // and a duel whose second player never comes
    const r = await live(reza);
    const { game: second } = (await (await post(reza, "/v1/games", { kind: "duel" })).json()) as { game: { id: string } };
    await post(mina, `/v1/games/${second.id}/join`);
    await r.expect("game.started");
    await advance(15_000);
    await r.expect("message");
    expect(await r.expect("game.ended")).toMatchObject({ gameId: second.id, winner: "reza", reason: "left" });
  });

  it("ends a duel nobody runs, in the sweep, with no winner", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const { game } = (await (await post(ali, "/v1/games", { kind: "duel" })).json()) as { game: { id: string } };
    await post(sara, `/v1/games/${game.id}/join`); // nobody is online: it waits, then the 15 seconds begin... but the server "restarts":
    h.deps.duels.stop();
    h.clock.time = new Date(h.clock.time.getTime() + 61_000);
    const { sweepGames } = await import("../src/games.js");
    expect(await sweepGames(h.deps)).toBe(1);
    const [row] = await h.db.select().from(games);
    expect(row).toMatchObject({ status: "done", winnerId: null, endReason: "left" });
  });

  it("stops the duel when a player gives up, and keeps the couplets of the rounds played", async () => {
    const { ali, a, s, id } = await startedDuel();
    await advance(3000);
    for (const c of [a, s]) await c.expect("duel.question");
    answer(s, id, 1, rightOption(1));
    for (const c of [a, s]) await c.expect("duel.round");
    await advance(2500);
    for (const c of [a, s]) await c.expect("duel.question");
    expect((await post(ali, `/v1/games/${id}/resign`)).status).toBe(200);
    for (const c of [a, s]) {
      await c.expect("message");
      const ended = await c.expect("game.ended");
      expect(ended).toMatchObject({ winner: "sara", reason: "resigned", couplets: [{ round: 1, key: questions[0]!.couplet.key, winner: "sara" }] });
    }
    const view = (await (await get(ali, `/v1/games/${id}`)).json()) as { rounds: { round: number; meaning: string }[] };
    expect(view.rounds.map((r) => r.round)).toEqual([1]);
    expect(view.rounds[0]!.meaning.length).toBeGreaterThan(0);
    await advance(20_000);
    await a.idle();
    await s.idle();
    expect(h.deps.duels.has(id)).toBe(false);
  });
});

describe("socket messages", () => {
  it("takes at most 10 a second from one socket; the rest are dropped", async () => {
    vi.useRealTimers();
    await server.close();
    await setup({ timings: { startDelayMs: 20 } });
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const a = await live(ali);
    const s = await live(sara);
    const { game } = (await (await post(ali, "/v1/games", { kind: "duel" })).json()) as { game: { id: string } };
    await post(sara, `/v1/games/${game.id}/join`);
    for (const c of [a, s]) await c.expect("game.started");
    for (const c of [a, s]) await c.expect("duel.question");
    for (let i = 0; i < 10; i++) a.send({ type: "nonsense" });
    answer(a, game.id, 1, rightOption(1)); // the 11th within the second
    await new Promise((r) => setTimeout(r, 300));
    await a.idle();
    await new Promise((r) => setTimeout(r, 900));
    answer(a, game.id, 1, rightOption(1));
    expect(await a.expect("duel.round")).toMatchObject({ round: 1, winner: "ali" });
  });
});
