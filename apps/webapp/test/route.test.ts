import { describe, expect, it } from "vitest";
import { isValidPath } from "../lib/poetry/store";
import { parseRoute, routeURL } from "../lib/reader/route";

describe("the reader's address", () => {
  it("reads the poem, the couplet, the mode and the meaning", () => {
    expect(parseRoute(["hafez", "ghazal", "sh3"], { c: "2", mode: "scroll", meaning: "1" })).toEqual({ path: "/hafez/ghazal/sh3", couplet: 2, mode: "scroll", meaning: true });
  });

  it("opens at the start, in couplet mode, when the query is missing or unreadable", () => {
    const start = { path: "/hafez/ghazal/sh3", couplet: 0, mode: "couplet", meaning: false };
    expect(parseRoute(["hafez", "ghazal", "sh3"], {})).toEqual(start);
    expect(parseRoute(["hafez", "ghazal", "sh3"], { c: "-3", mode: "x", meaning: "yes" })).toEqual(start);
    expect(parseRoute(["hafez", "ghazal", "sh3"], { c: "1.5" })).toEqual(start);
    expect(parseRoute(["hafez", "ghazal", "sh3"], { c: ["4", "5"] }).couplet).toBe(4);
  });

  it("writes the address a link reopens: the couplet, and the mode when it is not the usual", () => {
    expect(routeURL("/hafez/ghazal/sh3", 2, "couplet")).toBe("/poem/hafez/ghazal/sh3?c=2");
    expect(routeURL("/hafez/ghazal/sh3", 0, "scroll")).toBe("/poem/hafez/ghazal/sh3?c=0&mode=scroll");
    expect(parseRoute(["hafez", "ghazal", "sh3"], { c: "2", mode: "scroll" }).couplet).toBe(2);
  });

  it("does not decode the path a second time, so an encoded «..» stays a path that is refused", () => {
    const { path } = parseRoute(["hafez", "%2e%2e", "%252e%252e"], {});
    expect(path).toBe("/hafez/%2e%2e/%252e%252e");
    expect(isValidPath(path)).toBe(false);
  });
});
