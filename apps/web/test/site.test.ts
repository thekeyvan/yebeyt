import { describe, expect, it } from "vitest";
import { smartBanner } from "../lib/links";
import { wwwRedirect } from "../lib/host";

describe("wwwRedirect", () => {
  it("sends www.yebeyt.com to the apex with the same path and query", () => {
    expect(wwwRedirect("www.yebeyt.com", "/privacy?x=1")).toBe("https://yebeyt.com/privacy?x=1");
    expect(wwwRedirect("WWW.yebeyt.com:443", "/")).toBe("https://yebeyt.com/");
  });

  it("leaves every other host alone, also the health check's", () => {
    for (const host of ["yebeyt.com", "healthcheck.railway.app", "localhost:3000", "www.example.com", null]) expect(wwwRedirect(host, "/")).toBeNull();
  });
});

describe("smartBanner", () => {
  it("names the app, the App Clip and the page", () => {
    expect(smartBanner("https://yebeyt.com/c/7KQ2", "123456789")).toBe("app-id=123456789, app-clip-bundle-id=com.yebeyt.app.Clip, app-argument=https://yebeyt.com/c/7KQ2");
  });

  it("is left out until the app's App Store id is known", () => {
    expect(smartBanner("https://yebeyt.com/c/7KQ2", "")).toBeNull();
  });
});
