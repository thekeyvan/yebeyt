import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FaHome, { metadata as faHomeMeta } from "../app/(fa)/page";
import FaPrivacy, { metadata as faPrivacyMeta } from "../app/(fa)/privacy/page";
import FaTerms, { metadata as faTermsMeta } from "../app/(fa)/terms/page";
import FaSupport, { metadata as faSupportMeta } from "../app/(fa)/support/page";
import FaLayout, { metadata as faLayoutMeta } from "../app/(fa)/layout";
import EnHome, { metadata as enHomeMeta } from "../app/(en)/en/page";
import EnPrivacy, { metadata as enPrivacyMeta } from "../app/(en)/en/privacy/page";
import EnTerms, { metadata as enTermsMeta } from "../app/(en)/en/terms/page";
import EnSupport, { metadata as enSupportMeta } from "../app/(en)/en/support/page";
import EnLayout, { metadata as enLayoutMeta } from "../app/(en)/en/layout";
import { docPath } from "../lib/site";

const persian = /[\u0600-\u06FF]/;
const html = (page: () => ReactElement) => renderToStaticMarkup(page());
const h1 = (markup: string) => /<h1>([^<]*)<\/h1>/.exec(markup)?.[1] ?? "";
const footerOf = (markup: string) => /<footer[\s\S]*<\/footer>/.exec(markup)?.[0] ?? "";

const fa = [
  { path: "/", page: FaHome, meta: faHomeMeta, h1: "یه بیت" },
  { path: "/privacy", page: FaPrivacy, meta: faPrivacyMeta, h1: "حریم خصوصی" },
  { path: "/terms", page: FaTerms, meta: faTermsMeta, h1: "شرایط استفاده" },
  { path: "/support", page: FaSupport, meta: faSupportMeta, h1: "پشتیبانی" },
];
const en = [
  { path: "/en", page: EnHome, meta: enHomeMeta, h1: "yebeyt" },
  { path: "/en/privacy", page: EnPrivacy, meta: enPrivacyMeta, h1: "Privacy Policy" },
  { path: "/en/terms", page: EnTerms, meta: enTermsMeta, h1: "Terms of Use" },
  { path: "/en/support", page: EnSupport, meta: enSupportMeta, h1: "Support" },
];

describe("docPath", () => {
  it("gives the Persian and the English URL of each page", () => {
    expect(["", "privacy", "terms", "support"].map((d) => docPath("fa", d as never))).toEqual(["/", "/privacy", "/terms", "/support"]);
    expect(["", "privacy", "terms", "support"].map((d) => docPath("en", d as never))).toEqual(["/en", "/en/privacy", "/en/terms", "/en/support"]);
  });
});

describe("root layouts", () => {
  it("set lang and dir on <html> on the server", () => {
    expect(renderToStaticMarkup(<FaLayout>x</FaLayout>)).toMatch(/^<html lang="fa" dir="rtl">/);
    expect(renderToStaticMarkup(<EnLayout>x</EnLayout>)).toMatch(/^<html lang="en" dir="ltr">/);
  });

  it("give the English site its own title template and locale", () => {
    expect(faLayoutMeta.title).toMatchObject({ template: "%s · یه بیت" });
    expect(enLayoutMeta.title).toMatchObject({ template: "%s · yebeyt" });
    expect(enLayoutMeta.openGraph).toMatchObject({ locale: "en_US" });
    expect(faLayoutMeta.openGraph).toMatchObject({ locale: "fa_IR" });
  });
});

describe("Persian pages", () => {
  it.each(fa)("$path is Persian only", ({ page, h1: heading }) => {
    const markup = html(page);
    expect(h1(markup)).toBe(heading);
    expect(markup).not.toContain('id="en"');
    expect(markup).not.toContain('lang="en" dir="ltr"');
    expect(markup).not.toMatch(/Privacy Policy|Terms of Use|Common questions|Without an account/);
  });

  it.each(fa)("$path links the switch to the English page and the footer to Persian pages", ({ path, page }) => {
    const markup = html(page);
    const target = path === "/" ? "/en" : `/en${path}`;
    expect(markup).toContain(`<a class="lang" href="${target}" lang="en">English</a>`);
    for (const href of ["/privacy", "/terms", "/support"]) expect(markup).toContain(`<a href="${href}">`);
    expect(footerOf(markup)).not.toContain('href="/en/');
  });
});

describe("English pages", () => {
  it.each(en)("$path is English only, with no Persian heading", ({ page, h1: heading }) => {
    const markup = html(page);
    expect(h1(markup)).toBe(heading);
    expect(persian.test(h1(markup))).toBe(false);
    expect(footerOf(markup)).not.toMatch(persian);
    expect(markup).not.toContain('id="en"');
  });

  it.each(en)("$path links the switch to the Persian page and the footer to English pages", ({ path, page }) => {
    const markup = html(page);
    const target = path === "/en" ? "/" : path.slice(3);
    expect(markup).toContain(`<a class="lang" href="${target}" lang="fa">فارسی</a>`);
    for (const href of ["/en/privacy", "/en/terms", "/en/support"]) expect(markup).toContain(`<a href="${href}">`);
    expect(markup).toContain('href="mailto:hello@yebeyt.com"');
    expect(markup).toContain('href="https://ganjoor.net"');
    expect(markup).toContain('href="https://github.com/thekeyvan/yebeyt"');
    expect(footerOf(markup)).not.toMatch(/href="\/(privacy|terms|support)"/);
  });

  it("the English home has the store button and the brand links to /en", () => {
    const markup = html(EnHome);
    expect(markup).toContain("Download on the App Store");
    expect(markup).toContain('class="brand" href="/en"');
  });

  it("the English terms link to the English privacy policy", () => {
    expect(html(EnTerms)).toContain('<a href="/en/privacy">Privacy Policy</a>');
  });
});

describe("alternates", () => {
  it.each([...fa, ...en])("$path has a canonical URL and hreflang fa and en", ({ path, meta }) => {
    const faPath = path.startsWith("/en") ? path.slice(3) || "/" : path;
    const enPath = path.startsWith("/en") ? path : path === "/" ? "/en" : `/en${path}`;
    expect(meta.alternates).toEqual({ canonical: path, languages: { fa: faPath, en: enPath } });
    expect(meta.openGraph).toMatchObject({ url: path, locale: path.startsWith("/en") ? "en_US" : "fa_IR" });
  });

  it("titles the English pages with the English template", () => {
    expect(enPrivacyMeta.title).toBe("Privacy Policy");
    expect(enHomeMeta.title).toEqual({ absolute: "yebeyt · Every couplet, a game" });
  });
});
