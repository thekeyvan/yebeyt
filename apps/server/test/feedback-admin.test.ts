import { beforeEach, describe, expect, it } from "vitest";
import { makeHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

const ADMIN = "admin-token-for-tests";
const device = { appVersion: "2.0.0", deviceModel: "iPhone17,1", osVersion: "26.0" };

const send = async (json: Record<string, unknown>, token?: string) => {
  const res = await h.request("/v1/feedback", { method: "POST", json: { ...device, ...json }, token });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; uploadToken: string };
};
const upload = (id: string, kind: "screenshot" | "recording", token: string, contentType: string, body: Uint8Array) =>
  h.request(`/v1/feedback/${id}/${kind}`, { method: "PUT", headers: { "content-type": contentType, "x-upload-token": token }, body: body as BodyInit });
const list = async (query = "") => {
  const res = await h.request(`/v1/admin/feedback${query}`, { token: ADMIN });
  return { status: res.status, body: (await res.json()) as any };
};
const tick = () => (h.clock.time = new Date(h.clock.time.getTime() + 1000));

describe("admin feedback", () => {
  it("needs the admin token on every route", async () => {
    const { id } = await send({ type: "bug", text: "x" });
    const paths = ["/v1/admin/feedback", `/v1/admin/feedback/${id}/screenshot`, `/v1/admin/feedback/${id}/recording`];
    const { accessToken } = await h.signIn();
    for (const path of paths) {
      expect((await h.request(path)).status).toBe(401);
      expect((await h.request(path, { token: "wrong-token" })).status).toBe(401);
      expect((await h.request(path, { token: accessToken })).status).toBe(401);
    }
  });

  it("lists newest first, with the username, the details and the attachments", async () => {
    const { accessToken } = await h.signIn();
    await h.request("/v1/me/username", { method: "PUT", token: accessToken, json: { username: "hafez_fan" } });
    const first = await send({ type: "liked", text: "اول" });
    tick();
    const second = await send(
      { type: "bug", text: "دوم", frequency: "once", screen: "reader", technical: { network: "wifi", steps: ["a"] } },
      accessToken,
    );
    await upload(second.id, "screenshot", second.uploadToken, "image/png", new Uint8Array(1234));
    await upload(second.id, "recording", second.uploadToken, "video/mp4", new Uint8Array(99));

    const { status, body } = await list();
    expect(status).toBe(200);
    expect(body.nextBefore).toBeNull();
    expect(body.items.map((i: any) => i.id)).toEqual([second.id, first.id]);
    expect(body.items[0]).toEqual({
      id: second.id,
      type: "bug",
      text: "دوم",
      frequency: "once",
      game: null,
      screen: "reader",
      technical: { network: "wifi", steps: ["a"] },
      appVersion: "2.0.0",
      deviceModel: "iPhone17,1",
      osVersion: "26.0",
      username: "hafez_fan",
      createdAt: h.clock.time.toISOString(),
      attachments: [
        { kind: "recording", size: 99, contentType: "video/mp4" },
        { kind: "screenshot", size: 1234, contentType: "image/png" },
      ],
    });
    expect(body.items[1]).toMatchObject({ username: null, attachments: [], game: null, technical: null });
    expect(JSON.stringify(body)).not.toContain("uploadToken");
  });

  it("shows a game idea", async () => {
    await send({ type: "game", game: { how: "طوری", players: "solo" } });
    expect((await list()).body.items[0]).toMatchObject({ type: "game", text: null, game: { how: "طوری", players: "solo" } });
  });

  it("pages 50 at a time, even when many share one second", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 55; i++) {
      ids.push((await send({ type: "liked", text: `n${i}` })).id);
      if (i % 5 === 4) tick();
    }
    const one = (await list()).body;
    expect(one.items).toHaveLength(50);
    expect(typeof one.nextBefore).toBe("string");
    const two = (await list(`?before=${encodeURIComponent(one.nextBefore)}`)).body;
    expect(two.items).toHaveLength(5);
    expect(two.nextBefore).toBeNull();
    const seen = [...one.items, ...two.items].map((i: any) => i.id);
    expect(new Set(seen).size).toBe(55);
    expect([...seen].sort()).toEqual([...ids].sort());
  });

  it("filters by type, and rejects an unknown type or a bad cursor", async () => {
    await send({ type: "liked", text: "a" });
    await send({ type: "idea", text: "b" });
    expect((await list("?type=idea")).body.items.map((i: any) => i.text)).toEqual(["b"]);
    expect((await list("?type=nope")).status).toBe(400);
    expect((await list("?before=garbage")).status).toBe(400);
  });

  it("downloads a screenshot and a recording as attachments, with the stored type", async () => {
    const { id, uploadToken } = await send({ type: "bug", text: "x" });
    const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
    await upload(id, "screenshot", uploadToken, "image/png", png);
    await upload(id, "recording", uploadToken, "video/mp4", new Uint8Array([0, 0, 0, 24]));

    const shot = await h.request(`/v1/admin/feedback/${id}/screenshot`, { token: ADMIN });
    expect(shot.status).toBe(200);
    expect(shot.headers.get("content-type")).toBe("image/png");
    expect(shot.headers.get("content-disposition")).toMatch(/^attachment/);
    expect(shot.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await shot.arrayBuffer())).toEqual(png);

    const rec = await h.request(`/v1/admin/feedback/${id}/recording`, { token: ADMIN });
    expect(rec.headers.get("content-type")).toBe("video/mp4");
    expect(rec.headers.get("content-disposition")).toMatch(/^attachment/);
  });

  it("answers 404 when there is no such attachment or report", async () => {
    const { id } = await send({ type: "bug", text: "x" });
    expect((await h.request(`/v1/admin/feedback/${id}/screenshot`, { token: ADMIN })).status).toBe(404);
    expect((await h.request(`/v1/admin/feedback/11111111-1111-4111-8111-111111111111/recording`, { token: ADMIN })).status).toBe(404);
    expect((await h.request(`/v1/admin/feedback/nope/recording`, { token: ADMIN })).status).toBe(400);
  });
});
