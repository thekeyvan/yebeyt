import { describe, expect, it } from "vitest";
import { upstreamRoute } from "../lib/api/proxy";

const route = (method: string, path: string, query = "") => upstreamRoute(method, path.split("/").filter(Boolean), new URLSearchParams(query));

const id = "6f1c2b9e-3a4d-4e8b-9c1d-0a2b3c4d5e6f";
const item = "0b9a8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d";

describe("what the /api door lets through for messages (W7)", () => {
  it("lets the chats, their messages and read marks through, each with its own methods, the session and only the query it names", () => {
    expect(route("GET", "v1/conversations", "cursor=a&x=1")).toEqual({ path: "/v1/conversations?cursor=a", auth: true });
    expect(route("POST", "v1/conversations")).toEqual({ path: "/v1/conversations", auth: true });
    expect(route("GET", `v1/conversations/${id}/messages`, "before=m3&limit=500")).toEqual({ path: `/v1/conversations/${id}/messages?before=m3`, auth: true });
    expect(route("POST", `v1/conversations/${id}/messages`)).toEqual({ path: `/v1/conversations/${id}/messages`, auth: true });
    expect(route("PUT", `v1/conversations/${id}/read`)).toEqual({ path: `/v1/conversations/${id}/read`, auth: true });
    expect(route("DELETE", `v1/messages/${id}`)).toEqual({ path: `/v1/messages/${id}`, auth: true });
  });

  it("lets the shared divans through: the list, a divan's couplets, adding, taking out, and the likes", () => {
    expect(route("GET", "v1/shared-divans", "cursor=2")).toEqual({ path: "/v1/shared-divans?cursor=2", auth: true });
    expect(route("POST", "v1/shared-divans")).toEqual({ path: "/v1/shared-divans", auth: true });
    expect(route("GET", `v1/shared-divans/${id}/items`, "by=them&cursor=c")).toEqual({ path: `/v1/shared-divans/${id}/items?by=them&cursor=c`, auth: true });
    expect(route("GET", `v1/shared-divans/${id}/items`, "by=nobody")?.path).toBe(`/v1/shared-divans/${id}/items`);
    expect(route("POST", `v1/shared-divans/${id}/items`)).toEqual({ path: `/v1/shared-divans/${id}/items`, auth: true });
    expect(route("DELETE", `v1/shared-divans/${id}/items/${item}`)).toEqual({ path: `/v1/shared-divans/${id}/items/${item}`, auth: true });
    expect(route("PUT", `v1/shared-divans/${id}/items/${item}/like`)?.path).toBe(`/v1/shared-divans/${id}/items/${item}/like`);
    expect(route("DELETE", `v1/shared-divans/${id}/items/${item}/like`)?.path).toBe(`/v1/shared-divans/${id}/items/${item}/like`);
  });

  it("lets nothing else of messages through: no other method, no sub-path, no live or admin route", () => {
    for (const [method, path] of [
      ["PUT", "v1/conversations"], ["DELETE", "v1/conversations"], ["GET", `v1/conversations/${id}`], ["DELETE", `v1/conversations/${id}`], ["PUT", `v1/conversations/${id}/messages`],
      ["DELETE", `v1/conversations/${id}/messages`], ["GET", `v1/conversations/${id}/read`], ["POST", `v1/conversations/${id}/read`], ["DELETE", `v1/conversations/${id}/read`],
      ["GET", `v1/conversations/${id}/other`], ["GET", `v1/messages/${id}`], ["PUT", `v1/messages/${id}`], ["POST", `v1/messages/${id}`], ["GET", "v1/messages"], ["DELETE", "v1/messages"],
      ["PUT", "v1/shared-divans"], ["DELETE", "v1/shared-divans"], ["GET", `v1/shared-divans/${id}`], ["DELETE", `v1/shared-divans/${id}`], ["PUT", `v1/shared-divans/${id}/items`],
      ["DELETE", `v1/shared-divans/${id}/items`], ["GET", `v1/shared-divans/${id}/items/${item}`], ["PUT", `v1/shared-divans/${id}/items/${item}`], ["POST", `v1/shared-divans/${id}/items/${item}`],
      ["GET", `v1/shared-divans/${id}/items/${item}/like`], ["POST", `v1/shared-divans/${id}/items/${item}/like`], ["PUT", `v1/shared-divans/${id}/items/${item}/other`],
      ["GET", "v1/live"], ["GET", "v1/admin/reports"],
    ] as const) {
      expect(route(method, path), `${method} ${path}`).toBeUndefined();
    }
  });

  it("checks every id in the path on its own: no dots, slashes, empty or long parts", () => {
    for (const bad of ["..", ".", "a/b", "a b", "", "a.b", "a?b", "a#b", "حافظ", "x".repeat(65), "a\\b", "%2e%2e"]) {
      for (const [method, parts] of [
        ["GET", ["v1", "conversations", bad, "messages"]],
        ["PUT", ["v1", "conversations", bad, "read"]],
        ["DELETE", ["v1", "messages", bad]],
        ["GET", ["v1", "shared-divans", bad, "items"]],
        ["DELETE", ["v1", "shared-divans", id, "items", bad]],
        ["PUT", ["v1", "shared-divans", bad, "items", item, "like"]],
        ["PUT", ["v1", "shared-divans", id, "items", bad, "like"]],
      ] as const) {
        expect(upstreamRoute(method, [...parts], new URLSearchParams()), `${method} ${parts.join("/")}`).toBeUndefined();
      }
    }
  });

  it("drops a query value that is not plain", () => {
    expect(route("GET", `v1/conversations/${id}/messages`, "before=a%0Ab")?.path).toBe(`/v1/conversations/${id}/messages`);
    expect(route("GET", "v1/conversations", `cursor=${"c".repeat(401)}`)?.path).toBe("/v1/conversations");
  });
});
