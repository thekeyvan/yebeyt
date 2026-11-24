import { afterEach, describe, expect, it, vi } from "vitest";
import { getChallenge, getPublicGame, getPublicUser } from "../lib/api";

const respond = (status: number, body: unknown = {}) => vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
afterEach(() => vi.unstubAllGlobals());

describe("the api calls of the link pages", () => {
  it("get a challenge from API_URL, with the code encoded", async () => {
    const fetchMock = respond(200, { game: "jigsaw" });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("API_URL", "http://api.test");
    expect(await getChallenge("7KQ2")).toEqual({ game: "jigsaw" });
    expect(fetchMock.mock.calls[0]![0]).toBe("http://api.test/v1/challenges/7KQ2");
    vi.unstubAllEnvs();
  });

  it("use the Railway URL until DNS is done", async () => {
    const fetchMock = respond(200, {});
    vi.stubGlobal("fetch", fetchMock);
    await getPublicUser("ali");
    await getPublicGame("K3M9");
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "https://server-production-98f46b7e.up.railway.app/v1/public/users/ali",
      "https://server-production-98f46b7e.up.railway.app/v1/public/games/K3M9",
    ]);
  });

  it("say null for an unknown or expired code, or a code that is not one", async () => {
    vi.stubGlobal("fetch", respond(404));
    expect(await getChallenge("ZZZZ")).toBeNull();
    vi.stubGlobal("fetch", respond(400));
    expect(await getPublicGame("12345")).toBeNull();
  });

  it("throws when the server is down, so the page shows its error and not «not found»", async () => {
    vi.stubGlobal("fetch", respond(503));
    await expect(getChallenge("7KQ2")).rejects.toThrow();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(getChallenge("7KQ2")).rejects.toThrow();
  });

  it("does not call the server for a username that cannot exist", async () => {
    const fetchMock = respond(200);
    vi.stubGlobal("fetch", fetchMock);
    expect(await getPublicUser("a/b")).toBeNull();
    expect(await getPublicUser("x".repeat(65))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
