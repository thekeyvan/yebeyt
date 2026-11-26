import { describe, expect, it } from "vitest";
import { upstreamRoute } from "../lib/api/proxy";

const route = (method: string, path: string, query = "") => upstreamRoute(method, path.split("/").filter(Boolean), new URLSearchParams(query));

describe("what the /api proxy lets through", () => {
  it("allows the poet pictures without a session, for GET only", () => {
    expect(route("GET", "v1/poets/pictures")).toEqual({ path: "/v1/poets/pictures", auth: false });
    expect(route("GET", "v1/poets/hafez/picture", "v=ab12")).toEqual({ path: "/v1/poets/hafez/picture?v=ab12", auth: false });
    expect(route("GET", "v1/poets/a_b-9/picture")).toEqual({ path: "/v1/poets/a_b-9/picture", auth: false });
    expect(route("PUT", "v1/poets/pictures")).toBeUndefined();
  });

  it("allows what the account, the divan, the reactions and the scores use, each with its own methods and a session", () => {
    expect(route("GET", "v1/usernames/check", "u=niloofar")).toEqual({ path: "/v1/usernames/check?u=niloofar", auth: true });
    expect(route("GET", "v1/usernames/suggestions", "base=beyt")).toEqual({ path: "/v1/usernames/suggestions?base=beyt", auth: true });
    expect(route("PUT", "v1/me/username")).toEqual({ path: "/v1/me/username", auth: true });
    expect(route("PUT", "v1/me/profile")).toEqual({ path: "/v1/me/profile", auth: true });
    expect(route("GET", "v1/me/divan")?.path).toBe("/v1/me/divan");
    expect(route("PUT", "v1/me/divan")?.path).toBe("/v1/me/divan");
    expect(route("GET", "v1/me/reactions", "cursor=a")?.path).toBe("/v1/me/reactions?cursor=a");
    expect(route("PUT", "v1/reactions/like", "key=/a/b%230")?.path).toBe("/v1/reactions/like?key=%2Fa%2Fb%230");
    expect(route("DELETE", "v1/reactions/repost", "key=/a/b%231")?.path).toBe("/v1/reactions/repost?key=%2Fa%2Fb%231");
    expect(route("POST", "v1/scores")?.path).toBe("/v1/scores");
    expect(route("POST", "v1/daily")?.path).toBe("/v1/daily");
    expect(route("GET", "v1/me/stats")?.path).toBe("/v1/me/stats");
    expect(route("PUT", "v1/me/progress")?.path).toBe("/v1/me/progress");
  });

  it("refuses a method a path is not allowed for", () => {
    for (const [method, path] of [["POST", "v1/me/divan"], ["DELETE", "v1/me/divan"], ["GET", "v1/me/username"], ["GET", "v1/scores"], ["PUT", "v1/scores"], ["GET", "v1/reactions/like"], ["POST", "v1/reactions/like"], ["PUT", "v1/me/stats"], ["PATCH", "v1/me/divan"], ["HEAD", "v1/me/stats"]]) {
      expect(route(method!, path!), `${method} ${path}`).toBeUndefined();
    }
  });

  it("refuses every other path, the sign-in ones and the deletion of the account included", () => {
    for (const path of ["", "v1", "v1/poets", "v1/me", "v1/poets/pictures/x", "v2/poets/pictures", "v1/poets/hafez", "v1/auth/apple", "v1/auth/refresh", "v1/auth/logout", "v1/me/avatar", "v1/me/friends", "v1/reactions/share", "v1/reactions/counts", "v1/reactions/like/x", "v1/admin/poets/hafez/picture"]) {
      for (const method of ["GET", "PUT", "POST", "DELETE"]) expect(route(method, path), `${method} ${path}`).toBeUndefined();
    }
  });

  it("refuses slugs that are not plain (upper case, dots, slashes, too long)", () => {
    for (const slug of ["Hafez", "..", ".", "a.b", "a/b", "../..", "..%2f..", "a b", "", "x".repeat(41), "حافظ", "a\\b", "a?b", "a#b"]) {
      expect(upstreamRoute("GET", ["v1", "poets", slug, "picture"], new URLSearchParams()), slug).toBeUndefined();
    }
  });

  it("refuses traversal in any segment", () => {
    for (const segments of [["v1", "poets", "..", "pictures"], ["v1", "..", "me", "divan"], ["v1", "me", "..", "divan"], ["v1", "poets", "hafez", ".."], ["v1", "poets", "hafez", "%2e%2e"], ["v1/me", "divan"], ["v1", "me/divan"], ["v1", "me", "divan", ""], ["v1", "reactions", "like/../repost"]]) {
      expect(upstreamRoute("GET", segments, new URLSearchParams()), segments.join("/")).toBeUndefined();
      expect(upstreamRoute("PUT", segments, new URLSearchParams()), segments.join("/")).toBeUndefined();
    }
  });

  it("passes on only the query a path knows, and only plain values of it", () => {
    expect(route("GET", "v1/poets/hafez/picture", "v=ab12&evil=1")?.path).toBe("/v1/poets/hafez/picture?v=ab12");
    expect(route("GET", "v1/poets/hafez/picture", "v=a/../b")?.path).toBe("/v1/poets/hafez/picture");
    expect(route("GET", "v1/me/stats", "u=1")?.path).toBe("/v1/me/stats");
    expect(route("GET", "v1/usernames/check", `u=${"a".repeat(500)}`)?.path).toBe("/v1/usernames/check");
    expect(route("GET", "v1/usernames/check", "u=a%0Ab")?.path).toBe("/v1/usernames/check");
    expect(route("GET", "v1/usernames/check", "u=a&u=b")?.path).toBe("/v1/usernames/check?u=a");
  });
});
