import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { sha256Hex } from "../src/crypto.js";
import { feedback, feedbackAttachments } from "../src/db/schema.js";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

const device = { appVersion: "2.0.0", deviceModel: "iPhone17,1", osVersion: "26.0" };
const technical = {
  screen: "reader",
  couplet: "/hafez/ghazal/sh3#2",
  mode: "scroll",
  recitationPosition: 12.5,
  textSettings: { size: 3, bold: false, font: "naskh" },
  network: "wifi",
  accountState: "guest",
  recentErrors: ["timeout"],
  steps: ["opened a poem", "tapped listen"],
};
const gameIdea = { name: "قافیه‌باز", how: "یک واژه می‌آید و باید قافیه‌اش را پیدا کنی", players: "both" };

const BODIES = {
  bug: { type: "bug", text: "کار نمی‌کند", frequency: "always", screen: "reader", technical, ...device },
  annoyed: { type: "annoyed", text: "کند است", screen: "library", ...device },
  idea: { type: "idea", text: "یک ایده", ...device },
  game: { type: "game", game: gameIdea, ...device },
  liked: { type: "liked", text: "دوستش دارم", ...device },
} as const;

const post = (json: unknown, token?: string) => h.request("/v1/feedback", { method: "POST", json, token });
const created = async (json: unknown = BODIES.bug, token?: string) => {
  const res = await post(json, token);
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; uploadToken: string };
};
const put = (id: string, kind: "screenshot" | "recording", body: Uint8Array | string, contentType: string, token: string | null) =>
  h.request(`/v1/feedback/${id}/${kind}`, {
    method: "PUT",
    headers: { "content-type": contentType, ...(token ? { "x-upload-token": token } : {}) },
    body: body as BodyInit,
  });
const bytes = (n: number) => new Uint8Array(n).fill(7);

describe("POST /v1/feedback", () => {
  it.each(Object.keys(BODIES) as (keyof typeof BODIES)[])("accepts a %s report and stores it", async (type) => {
    const { id, uploadToken } = await created(BODIES[type]);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Buffer.from(uploadToken, "base64url")).toHaveLength(32);
    const [row] = await h.db.select().from(feedback).where(eq(feedback.id, id));
    expect(row).toMatchObject({ type, userId: null, appVersion: "2.0.0", deviceModel: "iPhone17,1", osVersion: "26.0" });
    expect(row!.uploadExpiresAt.getTime()).toBe(h.clock.time.getTime() + 15 * 60_000);
  });

  it("stores the technical info and the game idea as sent, and the text trimmed", async () => {
    const { id } = await created({ ...BODIES.bug, text: "  سلام \n" });
    const [row] = await h.db.select().from(feedback).where(eq(feedback.id, id));
    expect(row!.text).toBe("سلام");
    expect(row!.technical).toEqual(technical);
    const game = await created({ ...BODIES.game, text: "توضیح" });
    const [g] = await h.db.select().from(feedback).where(eq(feedback.id, game.id));
    expect(g!.game).toEqual(gameIdea);
    expect(g!.text).toBe("توضیح");
  });

  it("keeps only the sha256 of the upload token", async () => {
    const { id, uploadToken } = await created();
    const [row] = await h.db.select().from(feedback).where(eq(feedback.id, id));
    expect(row!.uploadTokenHash).toBe(sha256Hex(uploadToken));
    expect(JSON.stringify(row)).not.toContain(uploadToken);
  });

  it("accepts the smallest valid reports", async () => {
    await created({ type: "bug", text: "x", ...device });
    await created({ type: "bug", text: "x", technical: {}, ...device });
    await created({ type: "game", game: { how: "x", players: "solo" }, ...device });
  });

  const bad: [string, unknown][] = [
    ["an unknown type", { ...BODIES.liked, type: "praise" }],
    ["no type", { text: "x", ...device }],
    ["no text on a bug", { ...BODIES.bug, text: undefined }],
    ["no text on an idea", { type: "idea", ...device }],
    ["a blank text", { ...BODIES.liked, text: "  \n " }],
    ["a text of 2001 characters", { ...BODIES.liked, text: "x".repeat(2001) }],
    ["no appVersion", { ...BODIES.liked, appVersion: undefined }],
    ["no deviceModel", { ...BODIES.liked, deviceModel: undefined }],
    ["no osVersion", { ...BODIES.liked, osVersion: undefined }],
    ["a long appVersion", { ...BODIES.liked, appVersion: "1".repeat(21) }],
    ["a long deviceModel", { ...BODIES.liked, deviceModel: "x".repeat(41) }],
    ["a long osVersion", { ...BODIES.liked, osVersion: "1".repeat(21) }],
    ["an unknown top-level key", { ...BODIES.liked, email: "a@b.c" }],
    ["an unknown frequency", { ...BODIES.bug, frequency: "never" }],
    ["frequency on annoyed", { ...BODIES.annoyed, frequency: "once" }],
    ["frequency on an idea", { ...BODIES.idea, frequency: "once" }],
    ["technical on annoyed", { ...BODIES.annoyed, technical }],
    ["technical on an idea", { ...BODIES.idea, technical }],
    ["technical on liked", { ...BODIES.liked, technical }],
    ["technical on a game", { ...BODIES.game, technical }],
    ["screen on an idea", { ...BODIES.idea, screen: "home" }],
    ["screen on liked", { ...BODIES.liked, screen: "home" }],
    ["screen on a game", { ...BODIES.game, screen: "home" }],
    ["a screen of 65 characters", { ...BODIES.annoyed, screen: "s".repeat(65) }],
    ["game on a bug", { ...BODIES.bug, game: gameIdea }],
    ["game on liked", { ...BODIES.liked, game: gameIdea }],
    ["a game type without game", { type: "game", text: "x", ...device }],
    ["a game with no how", { ...BODIES.game, game: { players: "solo" } }],
    ["a game with a blank how", { ...BODIES.game, game: { how: " ", players: "solo" } }],
    ["a game with a long how", { ...BODIES.game, game: { how: "x".repeat(2001), players: "solo" } }],
    ["a game with a long name", { ...BODIES.game, game: { ...gameIdea, name: "x".repeat(61) } }],
    ["a game with bad players", { ...BODIES.game, game: { ...gameIdea, players: "all" } }],
    ["an unknown game key", { ...BODIES.game, game: { ...gameIdea, url: "x" } }],
    ["an unknown technical key", { ...BODIES.bug, technical: { ...technical, userText: "secret" } }],
    ["a bad network", { ...BODIES.bug, technical: { network: "5g" } }],
    ["a bad accountState", { ...BODIES.bug, technical: { accountState: "admin" } }],
    ["a string recitationPosition", { ...BODIES.bug, technical: { recitationPosition: "3" } }],
    ["a bad couplet", { ...BODIES.bug, technical: { couplet: "free text typed by the user" } }],
    ["a nested textSettings value", { ...BODIES.bug, technical: { textSettings: { a: { b: 1 } } } }],
    ["21 recentErrors", { ...BODIES.bug, technical: { recentErrors: Array(21).fill("e") } }],
    ["a recentError of 201 characters", { ...BODIES.bug, technical: { recentErrors: ["e".repeat(201)] } }],
    ["21 steps", { ...BODIES.bug, technical: { steps: Array(21).fill("s") } }],
    ["a step of 101 characters", { ...BODIES.bug, technical: { steps: ["s".repeat(101)] } }],
    ["a null technical", { ...BODIES.bug, technical: null }],
  ];
  it.each(bad)("rejects %s", async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_request" });
    expect(await h.db.select().from(feedback)).toHaveLength(0);
  });

  it("accepts the limits exactly", async () => {
    await created({
      ...BODIES.bug,
      text: "x".repeat(2000),
      screen: "s".repeat(64),
      appVersion: "1".repeat(20),
      deviceModel: "m".repeat(40),
      osVersion: "1".repeat(20),
      technical: { ...technical, recentErrors: Array(20).fill("e".repeat(200)), steps: Array(20).fill("s".repeat(100)) },
    });
    await created({ ...BODIES.game, game: { name: "n".repeat(60), how: "h".repeat(2000), players: "friends" } });
  });

  it("refuses a body over 32 KB", async () => {
    const res = await post({ ...BODIES.liked, text: "x".repeat(40_000) });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "payload_too_large" });
  });

  it("stores the user of a signed-in sender, and none for a guest", async () => {
    const { accessToken, user } = await h.signIn();
    const signed = await created(BODIES.liked, accessToken);
    const guest = await created(BODIES.liked);
    const [a] = await h.db.select().from(feedback).where(eq(feedback.id, signed.id));
    const [b] = await h.db.select().from(feedback).where(eq(feedback.id, guest.id));
    expect(a!.userId).toBe(user.id);
    expect(b!.userId).toBeNull();
  });

  it("answers 401 for a token that is not valid, rather than storing it as a guest report", async () => {
    expect((await post(BODIES.liked, "nonsense")).status).toBe(401);
    expect(await h.db.select().from(feedback)).toHaveLength(0);
  });

  it("stores nothing about the connection: no IP in any row or log", async () => {
    const ip = "203.0.113.77";
    const res = await h.request("/v1/feedback", {
      method: "POST",
      json: BODIES.bug,
      headers: { "x-forwarded-for": ip, "x-real-ip": ip, "cf-connecting-ip": ip, "user-agent": "SecretAgent/1.0" },
    });
    const { id, uploadToken } = (await res.json()) as { id: string; uploadToken: string };
    await put(id, "screenshot", bytes(10), "image/png", uploadToken);
    const rows = JSON.stringify([await h.db.select().from(feedback), await h.db.select().from(feedbackAttachments), h.logs]);
    expect(rows).not.toContain(ip);
    expect(rows).not.toContain("SecretAgent");
  });
});

describe("feedback rate limits", () => {
  it("lets a signed-in user send 10 an hour, per user", async () => {
    const a = await h.signIn("g-1");
    const b = await h.signIn("g-2");
    for (let i = 0; i < 10; i++) expect((await post(BODIES.liked, a.accessToken)).status).toBe(201);
    const res = await post(BODIES.liked, a.accessToken);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
    expect((await post(BODIES.liked, b.accessToken)).status).toBe(201);
    h.clock.time = new Date(h.clock.time.getTime() + 61 * 60_000);
    expect((await post(BODIES.liked, (await h.signIn("g-1")).accessToken)).status).toBe(201);
  });

  it("does not count a refused report", async () => {
    const a = await h.signIn();
    for (let i = 0; i < 20; i++) expect((await post({ type: "nope" }, a.accessToken)).status).toBe(400);
    expect((await post(BODIES.liked, a.accessToken)).status).toBe(201);
  });

  it("shares 120 an hour between all guests", async () => {
    for (let i = 0; i < 120; i++) expect((await post(BODIES.liked)).status).toBe(201);
    expect((await post(BODIES.liked)).status).toBe(429);
    const a = await h.signIn();
    expect((await post(BODIES.liked, a.accessToken)).status).toBe(201);
    h.clock.time = new Date(h.clock.time.getTime() + 61 * 60_000);
    expect((await post(BODIES.liked)).status).toBe(201);
  });
});

describe("feedback attachments", () => {
  it("stores a screenshot and a recording for a bug", async () => {
    const { id, uploadToken } = await created(BODIES.bug);
    const shot = await put(id, "screenshot", bytes(1000), "image/jpeg", uploadToken);
    expect(shot.status).toBe(204);
    expect((await put(id, "recording", bytes(5000), "video/mp4", uploadToken)).status).toBe(204);
    const rows = await h.db.select().from(feedbackAttachments).where(eq(feedbackAttachments.feedbackId, id));
    expect(rows.map((r) => [r.kind, r.contentType, r.size, r.bytes.length]).sort()).toEqual([
      ["recording", "video/mp4", 5000, 5000],
      ["screenshot", "image/jpeg", 1000, 1000],
    ]);
  });

  it.each(["annoyed", "idea"] as const)("allows a screenshot but no recording on %s", async (type) => {
    const { id, uploadToken } = await created(BODIES[type]);
    expect((await put(id, "screenshot", bytes(10), "image/png", uploadToken)).status).toBe(204);
    expect((await put(id, "recording", bytes(10), "video/mp4", uploadToken)).status).toBe(400);
  });

  it.each(["game", "liked"] as const)("allows no attachment on %s", async (type) => {
    const { id, uploadToken } = await created(BODIES[type]);
    expect((await put(id, "screenshot", bytes(10), "image/png", uploadToken)).status).toBe(400);
    expect((await put(id, "recording", bytes(10), "video/mp4", uploadToken)).status).toBe(400);
  });

  it("refuses a missing or wrong token, and another report's token", async () => {
    const a = await created();
    const b = await created();
    for (const token of [null, "wrong", b.uploadToken]) {
      const res = await put(a.id, "screenshot", bytes(10), "image/png", token);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "forbidden" });
    }
    expect(await h.db.select().from(feedbackAttachments)).toHaveLength(0);
  });

  it("refuses a token after 15 minutes", async () => {
    const { id, uploadToken } = await created();
    h.clock.time = new Date(h.clock.time.getTime() + 14 * 60_000);
    expect((await put(id, "screenshot", bytes(10), "image/png", uploadToken)).status).toBe(204);
    h.clock.time = new Date(h.clock.time.getTime() + 60_001);
    expect((await put(id, "recording", bytes(10), "video/mp4", uploadToken)).status).toBe(403);
  });

  it("answers 409 already_uploaded for a second upload of the same kind", async () => {
    const { id, uploadToken } = await created();
    await put(id, "screenshot", bytes(10), "image/png", uploadToken);
    const res = await put(id, "screenshot", bytes(20), "image/png", uploadToken);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already_uploaded" });
    const [row] = await h.db.select().from(feedbackAttachments);
    expect(row!.size).toBe(10);
  });

  it("answers 404 for an unknown report and 400 for a malformed id", async () => {
    const { uploadToken } = await created();
    expect((await put("11111111-1111-4111-8111-111111111111", "screenshot", bytes(10), "image/png", uploadToken)).status).toBe(404);
    expect((await put("not-an-id", "screenshot", bytes(10), "image/png", uploadToken)).status).toBe(400);
  });

  it("checks the media type", async () => {
    const { id, uploadToken } = await created();
    for (const type of ["image/webp", "image/gif", "text/html", "video/mp4", "application/octet-stream"]) {
      expect((await put(id, "screenshot", bytes(10), type, uploadToken)).status).toBe(415);
    }
    for (const type of ["image/png", "video/quicktime", "text/html"]) {
      expect((await put(id, "recording", bytes(10), type, uploadToken)).status).toBe(415);
    }
    expect((await put(id, "screenshot", bytes(10), "image/png; charset=binary", uploadToken)).status).toBe(204);
  });

  it("refuses an empty upload", async () => {
    const { id, uploadToken } = await created();
    expect((await put(id, "screenshot", bytes(0), "image/png", uploadToken)).status).toBe(400);
  });

  it("limits a screenshot to 3 MB and a recording to 25 MB", async () => {
    const { id, uploadToken } = await created();
    const MB = 1024 * 1024;
    const big = await put(id, "screenshot", bytes(3 * MB + 1), "image/png", uploadToken);
    expect(big.status).toBe(413);
    expect(await big.json()).toEqual({ error: "payload_too_large" });
    expect((await put(id, "recording", bytes(25 * MB + 1), "video/mp4", uploadToken)).status).toBe(413);
    expect((await put(id, "screenshot", bytes(3 * MB), "image/png", uploadToken)).status).toBe(204);
    expect((await put(id, "recording", bytes(2 * MB), "video/mp4", uploadToken)).status).toBe(204);
  });
});

describe("deleting the account", () => {
  it("keeps the feedback and its attachments as anonymous", async () => {
    const { accessToken, user } = await h.signIn();
    const { id, uploadToken } = await created(BODIES.bug, accessToken);
    await put(id, "screenshot", bytes(10), "image/png", uploadToken);
    const [before] = await h.db.select().from(feedback).where(eq(feedback.id, id));
    expect(before!.userId).toBe(user.id);

    expect((await h.request("/v1/me", { method: "DELETE", token: accessToken })).status).toBe(204);

    const [after] = await h.db.select().from(feedback).where(eq(feedback.id, id));
    expect(after).toMatchObject({ id, userId: null, text: "کار نمی‌کند", type: "bug" });
    expect(await h.db.select().from(feedbackAttachments)).toHaveLength(1);
  });
});
