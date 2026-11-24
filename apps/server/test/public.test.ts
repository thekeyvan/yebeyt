import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { games } from "../src/db/schema.js";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
type User = { token: string; id: string; username: string };

beforeEach(async () => {
  h = await makeHarness();
});

const get = (path: string) => h.request(path);
const makeGame = async (user: User, body: Record<string, unknown> = { kind: "mosh", turnSeconds: 120 }) => {
  const res = await h.request("/v1/games", { method: "POST", token: user.token, json: body });
  expect(res.status).toBe(201);
  return ((await res.json()) as { game: { id: string; code: string } }).game;
};

describe("GET /v1/public/users/{username}", () => {
  it("is open to anyone and gives only the username, the display name and the face", async () => {
    await h.signUp("Niloofar", { displayName: "نیلوفر" });
    const res = await get("/v1/public/users/niloofar");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ username: "niloofar", displayName: "نیلوفر", avatar: null });
  });

  it("is 404 for an unknown username, and for a name that is not a username", async () => {
    expect((await get("/v1/public/users/nobody")).status).toBe(404);
    expect((await get("/v1/public/users/search")).status).toBe(404);
  });

  it("is 404 for a person who has not chosen a username yet", async () => {
    await h.signIn("nameless");
    expect((await get("/v1/public/users/nameless")).status).toBe(404);
  });
});

describe("GET /v1/public/games/{code}", () => {
  it("tells the kind, who made it and that it waits, in any case of the code", async () => {
    const ali = await h.signUp("ali", { displayName: "علی" });
    const game = await makeGame(ali);
    const typed = game.code.toLowerCase().replaceAll("0", "o").replaceAll("1", "l");
    for (const code of [game.code, typed]) {
      const res = await get(`/v1/public/games/${code}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ kind: "mosh", creator: { username: "ali", displayName: "علی", avatar: null }, status: "waiting" });
    }
    const duel = await makeGame(ali, { kind: "duel" });
    expect(((await (await get(`/v1/public/games/${duel.code}`)).json()) as { kind: string }).kind).toBe("duel");
  });

  it("is 404 once the game has started or ended, and for an unknown or badly written code", async () => {
    const ali = await h.signUp("ali");
    const sara = await h.signUp("sara");
    const game = await makeGame(ali);
    expect((await h.request(`/v1/games/${game.id}/join`, { method: "POST", token: sara.token })).status).toBe(200);
    expect((await get(`/v1/public/games/${game.code}`)).status).toBe(404);
    await h.db.update(games).set({ status: "done" }).where(eq(games.id, game.id));
    expect((await get(`/v1/public/games/${game.code}`)).status).toBe(404);
    expect((await get("/v1/public/games/ZZZZ")).status).toBe(404);
    expect((await get("/v1/public/games/12345")).status).toBe(400);
    expect((await get("/v1/public/games/ILOU")).status).toBe(400);
  });
});

describe("rate limit", () => {
  it("lets both lookups together take 1200 a minute, then 429, and starts again the next minute", async () => {
    await h.signUp("ali");
    for (let i = 0; i < 600; i++) {
      expect((await get("/v1/public/users/ali")).status).toBe(200);
      expect((await get("/v1/public/games/ZZZZ")).status).toBe(404);
    }
    expect((await get("/v1/public/users/ali")).status).toBe(429);
    expect((await get("/v1/public/games/ZZZZ")).status).toBe(429);
    h.clock.time = new Date(h.clock.time.getTime() + 61_000);
    expect((await get("/v1/public/users/ali")).status).toBe(200);
  });
});
