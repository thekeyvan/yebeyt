import { describe, expect, it } from "vitest";
import { upstreamRoute } from "../lib/api/proxy";

const route = (method: string, path: string, query = "") => upstreamRoute(method, path.split("/").filter(Boolean), new URLSearchParams(query));

const id = "6f1c2b9e-3a4d-4e8b-9c1d-0a2b3c4d5e6f";

describe("what the /api door lets through for games with friends and challenges (W8)", () => {
  it("lets the games through, each with its own method and the session, and no query", () => {
    expect(route("POST", "v1/games", "x=1")).toEqual({ path: "/v1/games", auth: true });
    expect(route("GET", `v1/games/${id}`)).toEqual({ path: `/v1/games/${id}`, auth: true });
    expect(route("GET", "v1/games/g1")?.path).toBe("/v1/games/g1");
    expect(route("POST", `v1/games/${id}/join`)).toEqual({ path: `/v1/games/${id}/join`, auth: true });
    expect(route("POST", `v1/games/${id}/moves`)).toEqual({ path: `/v1/games/${id}/moves`, auth: true });
    expect(route("POST", `v1/games/${id}/resign`)).toEqual({ path: `/v1/games/${id}/resign`, auth: true });
    expect(route("GET", "v1/me/games")).toEqual({ path: "/v1/me/games", auth: true });
  });

  it("lets the challenges through: making one with the session, reading one and leaving a result with it when there is one (a guest has none)", () => {
    expect(route("POST", "v1/challenges")).toEqual({ path: "/v1/challenges", auth: true });
    expect(route("GET", "v1/challenges/7KQ2", "x=1")).toEqual({ path: "/v1/challenges/7KQ2", auth: "optional" });
    expect(route("GET", "v1/challenges/a1b2")?.path).toBe("/v1/challenges/a1b2");
    expect(route("POST", "v1/challenges/7KQ2/results")).toEqual({ path: "/v1/challenges/7KQ2/results", auth: "optional" });
  });

  it("lets nothing else of them through: no other method or sub-path, no joining by code, no list of my challenges", () => {
    for (const [method, path] of [
      ["GET", "v1/games"], ["PUT", "v1/games"], ["DELETE", "v1/games"], ["PUT", `v1/games/${id}`], ["POST", `v1/games/${id}`], ["DELETE", `v1/games/${id}`],
      ["GET", `v1/games/${id}/join`], ["PUT", `v1/games/${id}/join`], ["GET", `v1/games/${id}/moves`], ["GET", `v1/games/${id}/resign`], ["DELETE", `v1/games/${id}/resign`],
      ["POST", `v1/games/${id}/other`], ["POST", "v1/games/by-code/7K3M/join"], ["GET", "v1/games/by-code/7K3M"], ["GET", "v1/public/games/7K3M"],
      ["POST", "v1/me/games"], ["DELETE", "v1/me/games"], ["GET", "v1/me/challenges"], ["GET", "v1/challenges"], ["PUT", "v1/challenges"], ["DELETE", "v1/challenges"],
      ["PUT", "v1/challenges/7KQ2"], ["POST", "v1/challenges/7KQ2"], ["DELETE", "v1/challenges/7KQ2"], ["GET", "v1/challenges/7KQ2/results"], ["PUT", "v1/challenges/7KQ2/results"],
      ["DELETE", "v1/challenges/7KQ2/results"], ["POST", "v1/challenges/7KQ2/other"], ["GET", "v1/live"],
    ] as const) {
      expect(route(method, path), `${method} ${path}`).toBeUndefined();
    }
  });

  it("checks the id of a game and the code of a challenge on their own", () => {
    for (const bad of ["..", ".", "a/b", "a b", "", "a.b", "a?b", "a#b", "حافظ", "x".repeat(65), "%2e%2e"]) {
      for (const [method, parts] of [["GET", ["v1", "games", bad]], ["POST", ["v1", "games", bad, "join"]], ["POST", ["v1", "games", bad, "moves"]], ["POST", ["v1", "games", bad, "resign"]]] as const) {
        expect(upstreamRoute(method, [...parts], new URLSearchParams()), `${method} ${parts.join("/")}`).toBeUndefined();
      }
    }
    for (const bad of ["7KQ", "7KQ22", "7K/2", "7K 2", "..", "7K.2", "", "7K_2", "حافظ", "7KQ\n"]) {
      expect(upstreamRoute("GET", ["v1", "challenges", bad], new URLSearchParams()), `GET ${bad}`).toBeUndefined();
      expect(upstreamRoute("POST", ["v1", "challenges", bad, "results"], new URLSearchParams()), `POST ${bad}`).toBeUndefined();
    }
  });
});
