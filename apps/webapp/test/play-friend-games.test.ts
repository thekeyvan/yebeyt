import { describe, expect, it } from "vitest";
import type { LiveEvent } from "../lib/messages/liveEvents";
import { FriendGames } from "../lib/play/friendGames";
import type { MoshCandidate } from "../lib/play/moshSuggestions";
import { fakeServer, ok, refuse, type Answer, type Seen } from "./friends";
import { duelResult, game, niloofar, player, sara, saraMove } from "./play";

// The port of FriendGamesTests (PlayCenterTests.swift): reading, playing, and the live events, through the web app's own client against a fake door.

const clock = Date.parse("2026-11-24T10:00:00.000Z");

function rig(handler: (request: Seen) => Answer) {
  const server = fakeServer(handler);
  const games = new FriendGames({ api: server.api, me: () => "niloofar", now: () => clock });
  return { games, server };
}

const candidate = (key = "/hafez/ghazal/sh9#0"): MoshCandidate => ({ key, couplet: { m1: "دل می‌رود", m2: "خدا را" }, poetSlug: "hafez", title: "غزل ۹", inDivan: false, text: "دل می رود خدا را" });
const withMove = game({ moves: [saraMove] });
const turn = (username: string, deadline: string) => ({ username, deadline });

describe("the games of this browser", () => {
  it("reads a game and keeps it", async () => {
    const { games, server } = rig(() => ok(withMove));
    const read = await games.load("g1");
    expect([read?.moves.length, games.game("g1")?.id]).toEqual([1, "g1"]);
    expect(server.requests[0]?.path).toBe("/v1/games/g1");
  });

  it("finds the game where it is my turn and the time runs out first", async () => {
    const soon = game({ id: "soon", turn: turn("niloofar", "2026-11-24T10:00:00.000Z") });
    const later = game({ id: "later", turn: turn("niloofar", "2026-11-25T10:00:00.000Z") });
    const theirs = game({ id: "theirs", turn: turn("sara.ghazal", "2026-11-24T09:30:00.000Z") });
    const { games } = rig(() => ok({ items: [later, theirs, soon] }));
    expect(games.urgentMosh).toBeUndefined();
    await games.refreshMine();
    expect(games.mine.map((one) => one.id)).toEqual(["later", "theirs", "soon"]);
    expect(games.urgentMosh?.game.id).toBe("soon");
  });

  it("has no urgent game when none of mine waits for me", async () => {
    const { games } = rig(() => ok({ items: [game({ id: "theirs", turn: turn("sara.ghazal", "2026-11-24T09:30:00.000Z") })] }));
    await games.refreshMine();
    expect(games.urgentMosh).toBeUndefined();
  });

  it("sends a couplet with a move and keeps the answer", async () => {
    const after = game({ turn: turn("sara.ghazal", "2026-11-25T09:40:00.000Z"), moves: [saraMove] });
    const { games, server } = rig((request) => (request.path.endsWith("/moves") ? ok(after) : ok(withMove)));
    await games.load("g1");
    expect(await games.play(candidate(), "g1")).toBeUndefined();
    expect(server.requests.at(-1)).toMatchObject({ method: "POST", path: "/v1/games/g1/moves", json: { key: "/hafez/ghazal/sh9#0", m1: "دل می‌رود", m2: "خدا را" } });
    expect(games.game("g1")?.turn?.username).toBe("sara.ghazal");
  });

  it("gives the line of the board for a refused move", async () => {
    const { games } = rig((request) => (request.path.endsWith("/moves") ? refuse(409, "wrong_letter") : ok(withMove)));
    await games.load("g1");
    expect(await games.play(candidate(), "g1")).toBe("با حرف «د» شروع نمی‌شه");
  });

  it("reads the game again when the turn ran out", async () => {
    const done = game({ status: "done", winner: "sara.ghazal", endReason: "timeout", turn: null });
    const { games, server } = rig((request) => (request.path.endsWith("/moves") ? refuse(409, "turn_over") : ok(done)));
    await games.load("g1");
    expect(await games.play(candidate(), "g1")).toBe("وقتت تموم شد");
    expect(games.game("g1")?.status).toBe("done");
    expect(server.requests.filter((request) => request.method === "GET")).toHaveLength(2);
  });

  it("ends the game when I give up", async () => {
    const done = game({ status: "done", winner: "sara.ghazal", endReason: "resigned", turn: null });
    const { games, server } = rig((request) => (request.path.endsWith("/resign") ? ok(done) : ok(game())));
    await games.load("g1");
    expect(await games.resign("g1")).toBeUndefined();
    expect(server.requests.at(-1)?.path).toBe("/v1/games/g1/resign");
    expect(games.game("g1")?.endReason).toBe("resigned");
  });

  it("joins by the game's id, and a full game says so", async () => {
    const { games, server } = rig((request) => (request.path === "/v1/games/g1/join" ? ok(game({ id: "g1" })) : refuse(409, "game_full")));
    expect(await games.join("g1")).toBeUndefined();
    expect([server.requests.at(-1)?.path, games.game("g1") !== undefined]).toEqual(["/v1/games/g1/join", true]);
    expect(await games.join("g2")).toBe("یکی دیگه زودتر اومده توی این بازی");
  });

  it("makes a game with its invitations and keeps it in my list", async () => {
    const { games, server } = rig(() => ({ status: 201, body: { game: game({ status: "waiting", turn: null }), invited: ["sara.ghazal"], skipped: [] } }));
    const made = await games.create("mosh", 30, ["sara.ghazal"]);
    expect([made.invited, games.game("g1")?.status, games.mine.map((one) => one.id)]).toEqual([["sara.ghazal"], "waiting", ["g1"]]);
    expect(server.requests[0]).toMatchObject({ path: "/v1/games", json: { kind: "mosh", turnSeconds: 30, invite: ["sara.ghazal"] } });
  });
});

describe("the live events of games", () => {
  const event = (value: object) => value as LiveEvent;

  it("adds the couplet and the scores of a move, and the turn comes after", async () => {
    const { games } = rig(() => ok(game({ turn: turn("sara.ghazal", "2026-11-24T09:41:00.000Z") })));
    await games.load("g1");
    const scores = [{ username: "sara.ghazal", score: 1 }, { username: "niloofar", score: 0 }];
    games.handle({ type: "game.move", gameId: "g1", move: saraMove, scores });
    games.handle({ type: "game.move", gameId: "g1", move: saraMove, scores }); // the same move twice changes nothing
    expect([games.game("g1")?.moves.length, games.game("g1")?.players.find((one) => one.username === "sara.ghazal")?.score]).toEqual([1, 1]);
    games.handle({ type: "game.turn", gameId: "g1", username: "niloofar", deadline: "2026-11-25T09:40:00.000Z" });
    expect(games.game("g1")?.turn).toEqual(turn("niloofar", "2026-11-25T09:40:00.000Z"));
  });

  it("closes the game with an ended event", async () => {
    const { games } = rig(() => ok(game()));
    await games.load("g1");
    games.handle({ type: "game.ended", gameId: "g1", winner: "niloofar", reason: "timeout", scores: [], couplets: [] });
    expect(games.game("g1")).toMatchObject({ status: "done", winner: "niloofar", endReason: "timeout", turn: null });
  });

  it("keeps the couplets already known when a started event brings none", async () => {
    const { games } = rig(() => ok(withMove));
    await games.load("g1");
    games.handle({ type: "game.started", game: game() });
    expect(games.game("g1")?.moves).toHaveLength(1);
  });

  it("toasts a guest's result on my challenge, and not an account's (it comes as a chat line too)", () => {
    const { games } = rig(() => refuse(404, "not_found"));
    const toasts: string[] = [];
    games.toast = (line) => toasts.push(line);
    games.handle(event({ type: "challenge.result", code: "7KQ2", game: "jigsaw", result: { name: "کیان", username: null, score: 9, seconds: 80 } }));
    games.handle(event({ type: "challenge.result", code: "7KQ2", game: "jigsaw", result: { name: "سارا", username: "sara.ghazal", score: 7, seconds: 80 } }));
    expect(toasts).toEqual(["کیان توی چالشت ۹ از ۱۰ گرفت"]);
  });

  it("does not put the game back with a read that was asked before a live event", async () => {
    let release!: () => void;
    const older = game({ turn: turn("sara.ghazal", "2026-11-25T09:40:00.000Z"), moves: [] }); // before Sara's move: her turn
    const server = fakeServer(async () => {
      await new Promise<void>((resolve) => (release = resolve));
      return ok(older);
    });
    const games = new FriendGames({ api: server.api, me: () => "niloofar", now: () => clock });
    const loading = games.load("g1");
    await new Promise((resolve) => setTimeout(resolve, 5));
    games.handle({ type: "game.started", game: game({ moves: [] }) });
    games.handle({ type: "game.move", gameId: "g1", move: saraMove, scores: [{ username: "sara.ghazal", score: 1 }] });
    games.handle({ type: "game.turn", gameId: "g1", username: "niloofar", deadline: "2099-01-01T00:00:00.000Z" });
    release();
    await loading;
    expect([games.game("g1")?.moves.length, games.game("g1")?.turn?.username]).toEqual([1, "niloofar"]); // the older answer was dropped
  });

  it("forgets the games on sign-out", async () => {
    const { games } = rig(() => ok(game()));
    await games.load("g1");
    games.reset();
    expect([games.game("g1"), games.mine]).toEqual([undefined, []]);
  });

  it("reads the open games again when the socket comes back", async () => {
    const { games, server } = rig((request) => (request.path === "/v1/me/games" ? ok({ items: [game()] }) : ok(game())));
    await games.load("g1");
    await games.reconnected();
    expect(server.requests.map((request) => request.path)).toEqual(["/v1/games/g1", "/v1/me/games", "/v1/games/g1"]);
  });
});

describe("a duel in the games store", () => {
  const duel = game({ id: "d1", kind: "duel", turnSeconds: 8, turn: null });
  const question = (round: number, options = 3): LiveEvent => ({ type: "duel.question", question: { gameId: "d1", round, rounds: 5, kind: "second", m1: "x", options: ["a", "b", "c"].slice(0, options), deadlineMs: 8000 } });

  it("follows the events and sends my answer over the socket, once", async () => {
    const { games } = rig(() => ok(duel));
    const sent: string[] = [];
    games.sendLive = (text) => (sent.push(text), true);
    await games.load("d1");
    games.handle(question(1));
    expect(games.duel("d1")?.round).toBe(1);
    games.answer(1, "d1");
    games.answer(2, "d1"); // a second answer is not sent
    expect(games.duel("d1")?.chosen).toBe(1);
    expect(sent.map((text) => JSON.parse(text))).toEqual([{ type: "duel.answer", gameId: "d1", round: 1, option: 1 }]);
  });

  it("takes an answer back, and toasts, when it could not be sent", async () => {
    const { games } = rig(() => ok(duel));
    const toasts: string[] = [];
    games.toast = (line) => toasts.push(line);
    games.sendLive = () => false; // the socket is not open
    await games.load("d1");
    games.handle(question(1, 2));
    games.answer(0, "d1");
    expect([games.duel("d1")?.chosen, games.duel("d1")?.canAnswer]).toEqual([undefined, true]);
    expect(toasts).toEqual(["جوابت نرسید؛ دوباره بزن"]);
  });

  it("waits for the friend and starts when they join", async () => {
    const waiting = game({ id: "d1", kind: "duel", turnSeconds: 8, status: "waiting", players: [player("niloofar", 0)], turn: null });
    const { games } = rig(() => ok(waiting));
    await games.load("d1");
    expect(games.duel("d1")).toBeUndefined(); // nobody to play against: the screen says «منتظر دوستت…»
    games.handle({ type: "game.started", game: game({ id: "d1", kind: "duel", turnSeconds: 8, turn: null }) });
    const started = games.duel("d1")!;
    expect([started.other, started.question, started.isEnded]).toEqual(["sara.ghazal", undefined, false]); // started: «منتظر سارا…» until the first question
    expect(games.mine.map((one) => one.id)).toEqual(["d1"]);
  });

  it("has its end from the game itself when it ended while the page was away", async () => {
    const done = game({ id: "d1", kind: "duel", turnSeconds: 8, status: "done", winner: "niloofar", endReason: "left", turn: null, rounds: [duelResult(1, "niloofar")], players: [sara, niloofar] });
    const { games } = rig(() => ok(done));
    await games.load("d1");
    const state = games.duel("d1")!;
    expect([state.isEnded, state.endTitle("سارا"), state.ending?.couplets.length]).toEqual([true, "سارا رفت", 1]);
  });
});
