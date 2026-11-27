import { describe, expect, it } from "vitest";
import { isUsername, upstreamRoute } from "../lib/api/proxy";

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

  it("allows what Me adds (W5), each with its own method and a session: the avatar, the privacy settings and deleting the account", () => {
    expect(route("PUT", "v1/me/avatar")).toEqual({ path: "/v1/me/avatar", auth: true });
    expect(route("GET", "v1/me/privacy")).toEqual({ path: "/v1/me/privacy", auth: true });
    expect(route("PUT", "v1/me/privacy")).toEqual({ path: "/v1/me/privacy", auth: true });
    expect(route("DELETE", "v1/me")).toEqual({ path: "/v1/me", auth: true });
  });

  it("allows nothing else of Me: no reading of the account through the door, no other method on the new paths", () => {
    for (const [method, path] of [["GET", "v1/me"], ["PUT", "v1/me"], ["POST", "v1/me"], ["GET", "v1/me/avatar"], ["POST", "v1/me/avatar"], ["DELETE", "v1/me/avatar"], ["POST", "v1/me/privacy"], ["DELETE", "v1/me/privacy"], ["PATCH", "v1/me/privacy"], ["DELETE", "v1/me/profile"], ["DELETE", "v1/me/username"], ["GET", "v1/me/blocks"]]) {
      expect(route(method!, path!), `${method} ${path}`).toBeUndefined();
    }
    expect(route("DELETE", "v1/me", "x=1")).toEqual({ path: "/v1/me", auth: true }); // no query goes on
  });

  it("allows what friends use (W6), each with its own methods, the session, and only the query it names", () => {
    expect(route("GET", "v1/users/search", "q=ar&x=1")).toEqual({ path: "/v1/users/search?q=ar", auth: true });
    expect(route("GET", "v1/users/aryan")).toEqual({ path: "/v1/users/aryan", auth: true });
    expect(route("GET", "v1/users/kian_k.2")?.path).toBe("/v1/users/kian_k.2");
    expect(route("POST", "v1/friend-requests/raha")).toEqual({ path: "/v1/friend-requests/raha", auth: true });
    expect(route("DELETE", "v1/friend-requests/paria")?.path).toBe("/v1/friend-requests/paria");
    expect(route("POST", "v1/friend-requests/aryan/accept")?.path).toBe("/v1/friend-requests/aryan/accept");
    expect(route("POST", "v1/friend-requests/aryan/reject")?.path).toBe("/v1/friend-requests/aryan/reject");
    expect(route("DELETE", "v1/friends/kian_k")?.path).toBe("/v1/friends/kian_k");
    expect(route("GET", "v1/me/friends", "cursor=2")?.path).toBe("/v1/me/friends?cursor=2");
    expect(route("GET", "v1/me/friend-requests", "direction=outgoing&cursor=a")?.path).toBe("/v1/me/friend-requests?direction=outgoing&cursor=a");
    expect(route("GET", "v1/me/unread")).toEqual({ path: "/v1/me/unread", auth: true });
    expect(route("PUT", "v1/blocks/bardia")).toEqual({ path: "/v1/blocks/bardia", auth: true });
    expect(route("POST", "v1/reports")).toEqual({ path: "/v1/reports", auth: true });
    expect(route("GET", "v1/leaderboard/league")?.path).toBe("/v1/leaderboard/league");
    expect(route("GET", "v1/leaderboard/friends")?.path).toBe("/v1/leaderboard/friends");
    expect(route("GET", "v1/leaderboard/global", "cursor=50")?.path).toBe("/v1/leaderboard/global?cursor=50");
    expect(route("GET", "v1/feed", "cursor=x")?.path).toBe("/v1/feed?cursor=x");
    expect(route("GET", "v1/reactions/counts", "keys=/a/b%230,/a/b%231")?.path).toBe("/v1/reactions/counts?keys=%2Fa%2Fb%230%2C%2Fa%2Fb%231");
  });

  it("allows nothing else of friends: no other method, no unblocking, no list of blocks, no admin, no sub-paths", () => {
    for (const [method, path] of [
      ["POST", "v1/users/search"], ["PUT", "v1/users/aryan"], ["DELETE", "v1/users/aryan"], ["GET", "v1/users"], ["GET", "v1/users/aryan/x"],
      ["GET", "v1/friend-requests/aryan"], ["PUT", "v1/friend-requests/aryan"], ["GET", "v1/friend-requests/aryan/accept"], ["DELETE", "v1/friend-requests/aryan/accept"],
      ["PUT", "v1/friend-requests/aryan/reject"], ["POST", "v1/friend-requests/aryan/other"], ["POST", "v1/friend-requests"],
      ["GET", "v1/friends/aryan"], ["POST", "v1/friends/aryan"], ["GET", "v1/friends"], ["DELETE", "v1/me/friends"], ["POST", "v1/me/friends"], ["POST", "v1/me/friend-requests"],
      ["DELETE", "v1/blocks/bardia"], ["GET", "v1/blocks/bardia"], ["POST", "v1/blocks/bardia"], ["GET", "v1/me/blocks"], ["GET", "v1/reports"], ["PUT", "v1/reports"], ["GET", "v1/admin/reports"],
      ["POST", "v1/me/unread"], ["POST", "v1/leaderboard/league"], ["GET", "v1/leaderboard"], ["GET", "v1/leaderboard/weekly"], ["POST", "v1/feed"], ["PUT", "v1/reactions/counts"],
    ] as const) {
      expect(route(method, path), `${method} ${path}`).toBeUndefined();
    }
  });

  it("checks the username in the path one part at a time, and the query values it passes on", () => {
    for (const name of ["..", ".", "a/b", "a b", "", "9lives", ".hidden", "a?b", "a#b", "حافظ", "x".repeat(65), "a\\b"]) {
      for (const parts of [["v1", "users", name], ["v1", "friend-requests", name], ["v1", "friend-requests", name, "accept"], ["v1", "friends", name], ["v1", "blocks", name]]) {
        expect(upstreamRoute(parts[3] ? "POST" : "GET", parts, new URLSearchParams()), parts.join("/")).toBeUndefined();
      }
    }
    expect(route("GET", "v1/me/friend-requests", "direction=sideways&cursor=a")?.path).toBe("/v1/me/friend-requests?cursor=a");
    expect(route("GET", "v1/me/friend-requests", "cursor=" + "x".repeat(401))?.path).toBe("/v1/me/friend-requests");
    expect(route("GET", "v1/reactions/counts", "keys=" + "k".repeat(10_051))?.path).toBe("/v1/reactions/counts");
    expect(route("GET", "v1/users/search", "q=a\u0000b")?.path).toBe("/v1/users/search");
  });

  it("refuses a method a path is not allowed for", () => {
    for (const [method, path] of [["POST", "v1/me/divan"], ["DELETE", "v1/me/divan"], ["GET", "v1/me/username"], ["GET", "v1/scores"], ["PUT", "v1/scores"], ["GET", "v1/reactions/like"], ["POST", "v1/reactions/like"], ["PUT", "v1/me/stats"], ["PATCH", "v1/me/divan"], ["HEAD", "v1/me/stats"]]) {
      expect(route(method!, path!), `${method} ${path}`).toBeUndefined();
    }
  });

  it("refuses every other path, the sign-in ones included", () => {
    for (const path of ["", "v1", "v1/poets", "v1/me/x", "v1/me/avatar/x", "v1/me/privacy/x", "v1/poets/pictures/x", "v2/poets/pictures", "v1/poets/hafez", "v1/auth/apple", "v1/auth/refresh", "v1/auth/logout", "v1/reactions/share", "v1/reactions/like/x", "v1/admin/poets/hafez/picture"]) {
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

describe("what a page may take for a username", () => {
  it("is the pattern the door passes on: a letter first, then letters, digits, «_» and «.»", () => {
    for (const name of ["aryan", "kian_k", "sara.ghazal", "Raha9"]) expect(isUsername(name), name).toBe(true);
    for (const text of ["", "..", ".x", "9a", "a b", "a/b", "<b>x</b>", "حافظ", "پشتیبانی یه بیت", "a".repeat(65), "x?y"]) expect(isUsername(text), text).toBe(false);
  });
});
