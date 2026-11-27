import { afterEach, describe, expect, it, vi } from "vitest";
import { upstream } from "../lib/api/upstream";
import { challengeCode, duelId, moshId } from "../lib/api/stubPlay";
import { playStubHeaders } from "../lib/play/debug";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const spec = (account: object) => `debug-${Buffer.from(JSON.stringify(account)).toString("base64url")}`;

async function signIn() {
  const answer = await upstream({ method: "POST", path: "/v1/auth/apple", body: JSON.stringify({ identityToken: spec({ username: "niloofar", displayName: "نیلوفر" }), nonce: "n" }) });
  return ((await answer.json()) as { accessToken: string }).accessToken;
}

const guest = (method: string, path: string, body?: unknown) => upstream({ method, path, headers: { "x-beyt-play-stub": "1" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const mine = (token: string, method: string, path: string, body?: unknown) => upstream({ method, path, credential: token, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

describe("the debug server's games and challenges (the phone's PlayStub)", () => {
  it("has a مشاعره with Sara where it is my turn, chained on «س» and «د»", async () => {
    const token = await signIn();
    const list = (await (await mine(token, "GET", "/v1/me/games")).json()) as { items: { id: string; kind: string; turn: { username: string } }[] };
    expect(list.items.map((game) => [game.id, game.kind, game.turn.username])).toEqual([[moshId, "mosh", "niloofar"]]);
    const game = (await (await mine(token, "GET", `/v1/games/${moshId}`)).json()) as { moves: { n: number; username: string }[]; players: { username: string; score: number }[] };
    expect(game.moves.map((move) => [move.n, move.username])).toEqual([[1, "niloofar"], [2, "sara.ghazal"]]);
    expect(game.players.map((player) => player.score)).toEqual([4, 3]);
  });

  it("keeps a move, and Sara's answer to it is in the game two seconds later", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const token = await signIn();
    const after = (await (await mine(token, "POST", `/v1/games/${moshId}/moves`, { key: "/hafez/ghazal/sh9#0", m1: "الف", m2: "ب" })).json()) as { turn: { username: string }; moves: unknown[] };
    expect([after.turn.username, after.moves.length]).toEqual(["sara.ghazal", 3]);
    vi.setSystemTime(Date.now() + 2500);
    const later = (await (await mine(token, "GET", `/v1/games/${moshId}`)).json()) as { turn: { username: string }; moves: { n: number }[] };
    expect([later.turn.username, later.moves.map((move) => move.n)]).toEqual(["niloofar", [1, 2, 3, 4]]);
  });

  it("ends the game when I resign", async () => {
    const token = await signIn();
    const done = (await (await mine(token, "POST", `/v1/games/${moshId}/resign`)).json()) as { status: string; winner: string; endReason: string };
    expect([done.status, done.winner, done.endReason]).toEqual(["done", "sara.ghazal", "resigned"]);
  });

  it("makes a game that waits, and has a duel at round four of five", async () => {
    const token = await signIn();
    const made = (await (await mine(token, "POST", "/v1/games", { kind: "duel", invite: ["sara.ghazal"] })).json()) as { game: { id: string; status: string; turnSeconds: number }; invited: string[] };
    expect([made.game.id, made.game.status, made.game.turnSeconds, made.invited]).toEqual(["new-duel", "waiting", 8, ["sara.ghazal"]]);
    expect((await (await mine(token, "GET", "/v1/games/new-duel")).json()) as { status: string }).toMatchObject({ status: "waiting" });
    const duel = (await (await mine(token, "GET", `/v1/games/${duelId}`)).json()) as { kind: string; status: string; players: { score: number }[] };
    expect([duel.kind, duel.status, duel.players.map((player) => player.score)]).toEqual(["duel", "active", [2, 1]]);
    expect((await mine(token, "GET", "/v1/games/nothing")).status).toBe(404);
  });

  it("has the challenge 7KQ2: ten couplets by Saadi, 8 of 10", async () => {
    const token = await signIn();
    expect((await mine(token, "POST", "/v1/challenges", { game: "jigsaw", items: [], score: 8, seconds: 90 })).status).toBe(201);
    const board = (await (await mine(token, "GET", `/v1/challenges/${challengeCode}`)).json()) as { creator: { displayName: string }; game: string; items: string[]; score: number; label: string };
    expect([board.creator.displayName, board.game, board.items.length, board.score, board.label]).toEqual(["نیلوفر", "jigsaw", 10, 8, "۱۰ بیت سعدی"]);
    expect(board.items.every((key) => key.startsWith("/saadi/"))).toBe(true);
  });

  it("answers a visitor with no session only when the page asked for the stub, and only for games and challenges", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 599 })));
    expect((await upstream({ method: "GET", path: `/v1/challenges/${challengeCode}` })).status).toBe(599); // no ask: the server
    expect((await guest("GET", `/v1/challenges/${challengeCode.toLowerCase()}`)).status).toBe(200);
    expect((await guest("GET", "/v1/challenges/ZZZZ")).status).toBe(404);
    expect((await guest("GET", "/v1/me/divan")).status).toBe(599); // not a thing of the stub: it goes to the server
  });

  it("takes a guest's result only with a name", async () => {
    expect((await guest("POST", `/v1/challenges/${challengeCode}/results`, { score: 7, seconds: 90, name: "کیان" })).status).toBe(201);
    expect((await guest("POST", `/v1/challenges/${challengeCode}/results`, { score: 7, seconds: 90, name: "  " })).status).toBe(400);
    const token = await signIn();
    expect((await mine(token, "POST", `/v1/challenges/${challengeCode}/results`, { score: 7, seconds: 90 })).status).toBe(201);
  });

  it("is not there in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEV_PAGES", "");
    vi.stubEnv("API_URL", "http://api.test");
    const fetched = vi.fn(async () => Response.json({ error: "not_found" }, { status: 404 }));
    vi.stubGlobal("fetch", fetched);
    expect((await guest("GET", `/v1/challenges/${challengeCode}`)).status).toBe(404);
    expect(fetched).toHaveBeenCalledTimes(1);
  });
});

describe("the page's ask for the stub", () => {
  it("is made only in a debug build, with the flag in sessionStorage", () => {
    expect(playStubHeaders()).toEqual({});
    sessionStorage.setItem("beytPlayStub", "1");
    expect(playStubHeaders()).toEqual({ "x-beyt-play-stub": "1" });
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEV_PAGES", "");
    expect(playStubHeaders()).toEqual({});
    sessionStorage.clear();
  });
});
