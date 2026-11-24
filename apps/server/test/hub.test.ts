import { describe, expect, it } from "vitest";
import { createHub, MAX_SOCKETS_PER_USER } from "../src/hub.js";

describe("hub", () => {
  it("is online from the first socket to the last, and sends to every socket of a user", () => {
    const hub = createHub();
    const got: string[] = [];
    expect(hub.isOnline("a")).toBe(false);
    const one = hub.add("a", (e) => got.push(`1:${e.type}`));
    const two = hub.add("a", (e) => got.push(`2:${e.type}`));
    expect([one.first, two.first]).toEqual([true, false]);
    expect(hub.isOnline("a")).toBe(true);
    hub.publish("a", { type: "read" });
    hub.publish("b", { type: "read" });
    expect(got).toEqual(["1:read", "2:read"]);
    expect(one.remove()).toBe(false);
    expect(one.remove()).toBe(false);
    expect(hub.isOnline("a")).toBe(true);
    expect(two.remove()).toBe(true);
    expect(hub.isOnline("a")).toBe(false);
  });

  it("drops the oldest socket of a user past the cap", () => {
    const hub = createHub();
    const closed: number[] = [];
    const got: number[] = [];
    for (let i = 0; i < MAX_SOCKETS_PER_USER + 2; i++) hub.add("a", () => got.push(i), () => closed.push(i));
    expect(closed).toEqual([0, 1]);
    hub.publish("a", { type: "read" });
    expect(got).toEqual([2, 3, 4, 5, 6]);
  });
});
