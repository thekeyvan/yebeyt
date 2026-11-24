import { describe, expect, it } from "vitest";
import { GET } from "../app/.well-known/apple-app-site-association/route";
import { aasa } from "../lib/aasa";

describe("apple-app-site-association", () => {
  it("has the app's Universal Links and the App Clip", () => {
    expect(aasa).toEqual({
      applinks: { details: [{ appIDs: ["95YDC2AP63.com.yebeyt.app"], components: [{ "/": "/c/*" }, { "/": "/i/*" }, { "/": "/g/*" }] }] },
      appclips: { apps: ["95YDC2AP63.com.yebeyt.app.Clip"] },
    });
  });

  it("is served as JSON, with no redirect", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual(aasa);
  });
});
