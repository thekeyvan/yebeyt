import { randomInt } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { gamePlayers, games, type DuelRound } from "./db/schema.js";
import type { Deps } from "./deps.js";
import { duelRoundViews, endGame, playersOf, type PlayerRow } from "./games.js";
import { makeQuestions, type Question, ROUNDS, seededGenerator } from "./quiz.js";

/** Times of a duel, in milliseconds. A round lasts 8 seconds; a player away for more than 15 seconds loses. */
export const DUEL_TIMINGS = { startDelayMs: 3000, roundMs: 8000, pauseMs: 2500, absentMs: 15_000 };

type Run = {
  gameId: string;
  players: PlayerRow[];
  questions: Question[];
  /** 0-based index of the round being played. */
  round: number;
  open: boolean;
  askedAt: number;
  locked: Set<string>;
  scores: Map<string, number>;
  rounds: DuelRound[];
  timer?: NodeJS.Timeout;
};

const randomSeed = (): bigint => (BigInt(randomInt(2 ** 31)) << 32n) | BigInt(randomInt(2 ** 31));

/**
 * The live duels of this process (بازی رودررو). A duel starts when it is active and both players have an authenticated socket (`begin`, `online`):
 * after a short wait the server asks five questions, one at a time, over the sockets; the first right answer wins the round, a wrong answer locks that
 * player out of it, and when the time is up nobody wins it. A player with no socket for 15 seconds loses (the other wins; nobody if both are away).
 * The state lives in memory, so like the hub this works for one server instance only. Timers are plain `setTimeout`s.
 */
export function createDuels(deps: Deps, options: { seed?: () => bigint; timings?: Partial<typeof DUEL_TIMINGS> } = {}) {
  const t = { ...DUEL_TIMINGS, ...options.timings };
  const seed = options.seed ?? randomSeed;
  const runs = new Map<string, Run>();
  const absent = new Map<string, NodeJS.Timeout>();
  const absentKey = (gameId: string, userId: string) => `${gameId}:${userId}`;
  /** Timers run outside any request, so a failure is logged (the kind of error only) and the duel goes on or is cleaned up by the sweeper. */
  const guard = (what: string, work: Promise<unknown>) => work.catch(() => deps.log(`duel ${what} failed`));

  const publishAll = (run: Run, event: Parameters<Deps["hub"]["publish"]>[1]) => {
    for (const p of run.players) deps.hub.publish(p.userId, event);
  };
  const scoresOf = (run: Run) => run.players.map((p) => ({ username: p.username, score: run.scores.get(p.userId) ?? 0 }));

  const questionEvent = (run: Run, deadlineMs: number) => {
    const q = run.questions[run.round]!;
    const poet = deps.data.poets.find((p) => p.slug === q.couplet.poet)?.name ?? null;
    return {
      type: "duel.question" as const,
      gameId: run.gameId,
      round: run.round + 1,
      rounds: ROUNDS,
      // `kind`, not `type`: the event's own `type` is taken.
      kind: q.type,
      // The first hemistich for مصراع دوم (the second is what is asked); both for the other two. The poet is shown where the options already tell it.
      couplet: q.type === "second" ? { m1: q.couplet.m1 } : { m1: q.couplet.m1, m2: q.couplet.m2 },
      poet: q.type === "poet" ? null : poet,
      options: q.options,
      deadlineMs,
    };
  };

  async function ask(run: Run, round: number) {
    if (runs.get(run.gameId) !== run) return;
    run.round = round;
    run.open = true;
    run.askedAt = Date.now();
    run.locked.clear();
    publishAll(run, questionEvent(run, t.roundMs));
    run.timer = setTimeout(() => void guard("round", resolve(run, null)), t.roundMs);
  }

  async function resolve(run: Run, winnerId: string | null) {
    if (!run.open || runs.get(run.gameId) !== run) return;
    run.open = false;
    clearTimeout(run.timer);
    const question = run.questions[run.round]!;
    run.rounds.push({ round: run.round + 1, type: question.type, key: question.couplet.key, winnerId });
    if (winnerId) run.scores.set(winnerId, (run.scores.get(winnerId) ?? 0) + 1);
    publishAll(run, {
      type: "duel.round",
      gameId: run.gameId,
      round: run.round + 1,
      winner: run.players.find((p) => p.userId === winnerId)?.username ?? null,
      rightOption: question.correct,
      scores: scoresOf(run),
    });
    if (winnerId) await deps.db.update(gamePlayers).set({ score: sql`${gamePlayers.score} + 1` }).where(and(eq(gamePlayers.gameId, run.gameId), eq(gamePlayers.userId, winnerId)));
    if (runs.get(run.gameId) !== run) return;
    if (run.round + 1 < ROUNDS) {
      run.timer = setTimeout(() => void guard("round", ask(run, run.round + 1)), t.pauseMs);
      return;
    }
    runs.delete(run.gameId);
    const [a, b] = run.players;
    const [first, second] = [run.scores.get(a!.userId) ?? 0, run.scores.get(b!.userId) ?? 0];
    const winner = first === second ? null : first > second ? a! : b!;
    await deps.db.update(games).set({ rounds: run.rounds }).where(eq(games.id, run.gameId));
    await endGame(deps, run.gameId, winner?.userId ?? null, "finished", { couplets: duelRoundViews(deps.data, run.rounds, run.players) });
  }

  async function startRun(gameId: string, players: PlayerRow[]) {
    if (runs.has(gameId)) return;
    const run: Run = { gameId, players, questions: makeQuestions(deps.data, seededGenerator(seed())), round: 0, open: false, askedAt: 0, locked: new Set(), scores: new Map(), rounds: [] };
    runs.set(gameId, run); // before anything is awaited, so two triggers do not start it twice
    await deps.db.update(gamePlayers).set({ score: 0 }).where(eq(gamePlayers.gameId, gameId)); // a duel that starts again after a restart starts from zero
    if (runs.get(gameId) === run) run.timer = setTimeout(() => void guard("round", ask(run, 0)), t.startDelayMs);
  }

  function watchAbsence(gameId: string, userId: string) {
    const key = absentKey(gameId, userId);
    if (absent.has(key)) return;
    absent.set(
      key,
      setTimeout(() => {
        absent.delete(key);
        void guard("leave", leave(gameId, userId));
      }, t.absentMs),
    );
  }

  /** The player has been away for the whole grace time: the other wins (nobody does when the other is away too). */
  async function leave(gameId: string, userId: string) {
    if (deps.hub.isOnline(userId)) return;
    const players = (await playersOf(deps.db, [gameId])).get(gameId)!;
    const other = players.find((p) => p.userId !== userId);
    await endGame(deps, gameId, other && deps.hub.isOnline(other.userId) ? other.userId : null, "left");
  }

  const activeDuelsOf = async (userId: string): Promise<string[]> =>
    (
      await deps.db
        .select({ id: games.id })
        .from(games)
        .innerJoin(gamePlayers, eq(gamePlayers.gameId, games.id))
        .where(and(eq(gamePlayers.userId, userId), eq(games.kind, "duel"), eq(games.status, "active")))
    ).map((r) => r.id);

  /** Starts the duel when both players are online, otherwise gives the ones who are not 15 seconds to come. */
  async function ensure(gameId: string) {
    if (runs.has(gameId)) return;
    const players = (await playersOf(deps.db, [gameId])).get(gameId)!;
    if (players.length < 2) return;
    const away = players.filter((p) => !deps.hub.isOnline(p.userId));
    if (away.length === 0) await startRun(gameId, players);
    else for (const p of away) watchAbsence(gameId, p.userId);
  }

  return {
    /** The second player has joined a duel: run it, or wait for whoever is not online. */
    begin: (gameId: string) => ensure(gameId),

    /** A player's socket is authenticated: they are back (or here), so their duels can start or go on. */
    async online(userId: string) {
      for (const gameId of await activeDuelsOf(userId)) {
        clearTimeout(absent.get(absentKey(gameId, userId)));
        absent.delete(absentKey(gameId, userId));
        const run = runs.get(gameId);
        if (run?.open) deps.hub.publish(userId, questionEvent(run, Math.max(0, t.roundMs - (Date.now() - run.askedAt))));
        else await ensure(gameId);
      }
    },

    /** A player's last socket closed: if they do not come back within 15 seconds, they lose. */
    async offline(userId: string) {
      for (const gameId of await activeDuelsOf(userId)) watchAbsence(gameId, userId);
    },

    /** An answer from a socket. Wrong, late, repeated and foreign answers change nothing. */
    answer(userId: string, message: { gameId: string; round: number; option: number }) {
      const run = runs.get(message.gameId);
      const question = run?.questions[run.round];
      if (!run || !question || !run.open || message.round !== run.round + 1) return;
      if (!run.players.some((p) => p.userId === userId) || run.locked.has(userId) || message.option >= question.options.length) return;
      if (message.option === question.correct) {
        void guard("round", resolve(run, userId));
        return;
      }
      run.locked.add(userId);
      publishAll(run, { type: "duel.answered", gameId: run.gameId, round: message.round, username: run.players.find((p) => p.userId === userId)!.username });
      if (run.locked.size === run.players.length) void guard("round", resolve(run, null));
    },

    /** Whether the duel is being played by this process. */
    has: (gameId: string) => runs.has(gameId),

    /** The game ended some other way (a player gave up, left): stop its clocks. */
    abort(gameId: string) {
      const run = runs.get(gameId);
      if (run) run.open = false;
      clearTimeout(run?.timer);
      runs.delete(gameId);
      for (const [key, timer] of absent) {
        if (!key.startsWith(`${gameId}:`)) continue;
        clearTimeout(timer);
        absent.delete(key);
      }
    },

    /** Stops every clock (the server is closing). */
    stop() {
      for (const run of runs.values()) clearTimeout(run.timer);
      for (const timer of absent.values()) clearTimeout(timer);
      runs.clear();
      absent.clear();
    },
  };
}

export type Duels = ReturnType<typeof createDuels>;
