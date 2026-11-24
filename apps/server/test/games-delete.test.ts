import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { challengeResults, challenges, gamePlayers, games, moshMoves, scoreEvents } from "../src/db/schema.js";
import { loadGameData } from "../src/gameData.js";
import type { LiveEvent } from "../src/hub.js";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
type User = { token: string; id: string; username: string };
beforeEach(async () => {
  h = await makeHarness();
  h.fetchMock.mockImplementation(
    async () => new Response(JSON.stringify({ Verses: [{ VOrder: 1, Position: "Right", Text: "سلام", CoupletIndex: 0 }, { VOrder: 2, Position: "Left", Text: "خدا", CoupletIndex: 0 }] })),
  );
});

const post = (user: User, path: string, json?: unknown) => h.request(path, { method: "POST", token: user.token, json });
const items = loadGameData().deck.filter((c) => c.poet === "saadi").slice(0, 10).map((c) => c.key);

describe("DELETE /v1/me with games and challenges", () => {
  it("ends an active game with the other as winner, removes a waiting game, and keeps the other's finished game", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const live: LiveEvent[] = [];
    h.deps.hub.add(sara.id, (e) => live.push(e));
    const active = ((await (await post(ali, "/v1/games", { kind: "mosh", turnSeconds: 120 })).json()) as { game: { id: string } }).game.id;
    await post(sara, `/v1/games/${active}/join`);
    const waiting = ((await (await post(ali, "/v1/games", { kind: "duel" })).json()) as { game: { id: string } }).game.id;
    const done = ((await (await post(ali, "/v1/games", { kind: "mosh", turnSeconds: 30 })).json()) as { game: { id: string } }).game.id;
    await post(sara, `/v1/games/${done}/join`);
    await post(ali, `/v1/games/${done}/resign`);
    expect((await post(ali, `/v1/games/${active}/moves`, { key: "/a/b#0", m1: "سلام", m2: "خدا" })).status).toBe(200);
    live.length = 0;

    expect((await h.request("/v1/me", { method: "DELETE", token: ali.token })).status).toBe(204);

    const rows = await h.db.select().from(games);
    expect(rows.map((g) => g.id).sort()).toEqual([active, done].sort()); // the waiting game is gone
    expect(rows.find((g) => g.id === active)).toMatchObject({ status: "done", winnerId: sara.id, endReason: "left" });
    expect(rows.find((g) => g.id === done)).toMatchObject({ status: "done", winnerId: sara.id, createdBy: null });
    expect((await h.db.select().from(gamePlayers)).map((p) => p.userId)).toEqual([sara.id, sara.id]);
    expect(live.filter((e) => e.type === "game.ended")).toEqual([expect.objectContaining({ gameId: active, winner: "sara", reason: "left" })]);
    const move = await h.db.select().from(moshMoves).where(eq(moshMoves.gameId, active));
    expect(move.map((m) => m.userId)).toEqual([null]);
    // the other still sees the game, and the points of the one who stayed are kept
    const view = await h.request(`/v1/games/${active}`, { token: sara.token });
    expect(await view.json()).toMatchObject({ status: "done", winner: "sara", players: [{ username: "sara" }] });
    expect((await h.db.select().from(scoreEvents)).every((e) => e.userId === sara.id)).toBe(true);
  });

  it("removes their challenges with every result, and their results on other people's challenges", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const body = { game: "jigsaw", items, score: 8, seconds: 90 };
    const mine = (await (await post(ali, "/v1/challenges", body)).json()) as { code: string };
    const hers = (await (await post(sara, "/v1/challenges", body)).json()) as { code: string };
    await post({ token: "", id: "", username: "" }, `/v1/challenges/${mine.code}/results`, { score: 3, seconds: 9, name: "مهمان" });
    await post(sara, `/v1/challenges/${mine.code}/results`, { score: 4, seconds: 9 });
    await post(ali, `/v1/challenges/${hers.code}/results`, { score: 5, seconds: 9 });
    await post({ token: "", id: "", username: "" }, `/v1/challenges/${hers.code}/results`, { score: 6, seconds: 9, name: "مهمان" });

    expect((await h.request("/v1/me", { method: "DELETE", token: ali.token })).status).toBe(204);

    expect((await h.db.select().from(challenges)).map((c) => c.code)).toEqual([hers.code]);
    expect((await h.db.select().from(challengeResults)).map((r) => [r.userId, r.name, r.score])).toEqual([[null, "مهمان", 6]]);
    expect((await h.request(`/v1/challenges/${mine.code}`)).status).toBe(404);
  });
});
