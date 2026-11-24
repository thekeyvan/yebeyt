import { describe, expect, it } from "vitest";
import { lookup } from "../lib/lookup";

describe("lookup", () => {
  it("is found, missing or unavailable", async () => {
    expect(await lookup(async () => ({ a: 1 }))).toEqual({ status: "found", data: { a: 1 } });
    expect(await lookup(async () => null)).toEqual({ status: "missing" });
    expect(
      await lookup(async () => {
        throw new Error("api answered 503");
      }),
    ).toEqual({ status: "unavailable" });
  });
});
