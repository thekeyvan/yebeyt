import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NotFound from "../app/global-not-found";
import ErrorPage from "../app/(fa)/error";
import { LinkPage } from "../components/LinkPage";
import { Missing, Unavailable } from "../components/Missing";
import { challengeView } from "../lib/links";
import { lookupMetadata } from "../lib/pageMeta";
import config, { securityHeaders } from "../next.config";

const challenge = { creator: { username: "niloofar", displayName: "نیلوفر", avatar: null }, game: "jigsaw" as const, items: Array.from({ length: 10 }, (_, i) => `k${i}`), score: 8, seconds: 90, label: null };

describe("pages that find nothing, or fail", () => {
  it("are rendered on the server with an h1", () => {
    for (const Page of [NotFound, Unavailable, ErrorPage]) {
      expect(renderToStaticMarkup(<Page />), Page.name).toMatch(/<h1>[^<]+<\/h1>/);
    }
    expect(renderToStaticMarkup(<Missing title="این چالش پیدا نشد" hint="x" />)).toContain("<h1>این چالش پیدا نشد</h1>");
    expect(renderToStaticMarkup(<Unavailable />)).toContain("<h1>الان نشد</h1>");
  });

  it("show the Persian 404 for any unknown URL, in its own <html>", () => {
    expect(renderToStaticMarkup(<NotFound />)).toMatch(/^<html lang="fa" dir="rtl">/);
  });

  it("get a title and no indexing from their metadata", () => {
    const view = (n: number) => challengeView({ ...challenge, score: n }, "7KQ2");
    expect(lookupMetadata({ status: "missing" }, view, "این چالش پیدا نشد")).toEqual({ title: "این چالش پیدا نشد", robots: { index: false } });
    expect(lookupMetadata({ status: "unavailable" }, view, "این چالش پیدا نشد")).toEqual({ title: "الان نشد", robots: { index: false } });
    expect(lookupMetadata({ status: "found", data: 8 }, view, "x")).toMatchObject({ title: "نیلوفر تو رو به چالش کشیده!", robots: { index: false } });
  });
});

describe("LinkPage", () => {
  const view = challengeView(challenge, "7KQ2");

  it("leaves out «همین‌جا بازی کن» until the App Clip ships", () => {
    const html = renderToStaticMarkup(<LinkPage view={view} />);
    expect(html).not.toContain("همین‌جا بازی کن");
    expect(html).toMatch(/class="button primary"[^>]*>نصب «یه بیت» از اپ‌استور/);
    expect(html).toContain("7KQ2");
  });

  it("shows it once the flag is on", () => {
    const html = renderToStaticMarkup(<LinkPage view={view} appClip />);
    expect(html).toContain("همین‌جا بازی کن");
    expect(html).toMatch(/class="button secondary"[^>]*>نصب «یه بیت» از اپ‌استور/);
  });
});

describe("security headers", () => {
  it("go on every page: CSP with no framing, nosniff, a strict referrer policy and HSTS", async () => {
    const [rule] = await config.headers!();
    expect(rule!.source).toBe("/:path*");
    const byKey = Object.fromEntries(securityHeaders.map((h) => [h.key, h.value]));
    expect(byKey["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(byKey["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(byKey["Strict-Transport-Security"]).toMatch(/^max-age=\d+/);
    expect(rule!.headers).toEqual(securityHeaders);
  });
});
