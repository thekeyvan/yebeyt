import { describe, expect, it, vi } from "vitest";
import { bundledBook } from "../lib/poetry/bundled";
import type { Couplet, PoetsFile } from "../lib/poetry/models";
import { aiNote, bookFromRaw, groupCouplets, poemFromRaw, type RawVerse } from "../lib/poetry/raw";
import { isValidPath, PoetryError, PoetryStore, type BundledSource, type PoetryCache } from "../lib/poetry/store";
import { bundledFile, fixture } from "./files";

const verse = (VOrder: number, Position: string, Text: string, CoupletIndex?: number, CoupletSummary?: string): RawVerse => ({ VOrder, Position, Text, CoupletIndex, CoupletSummary });
const pair = (m1: string, m2: string): Couplet => ({ m1, m2 });

describe("grouping verses into couplets (Poetry/GanjoorRaw.swift)", () => {
  it("pairs Right and Left", () => {
    expect(groupCouplets([verse(1, "Right", "الف", 0), verse(2, "Left", "ب", 0), verse(3, "Right", "پ", 1), verse(4, "Left", "ت", 1)])).toEqual([pair("الف", "ب"), pair("پ", "ت")]);
  });

  it("keeps meanings where they exist and strips carriage returns", () => {
    const couplets = groupCouplets([verse(1, "Right", "الف\r", 0, "معنی\r\nدوم"), verse(2, "Left", "ب", 0), verse(3, "Right", "پ", 1), verse(4, "Left", "ت", 1)]);
    expect(couplets[0]).toEqual({ m1: "الف", m2: "ب", meaning: "معنی\nدوم" });
    expect(couplets[1]?.meaning).toBeUndefined();
  });

  it("strips the AI label and flags it", () => {
    const couplets = groupCouplets([
      verse(1, "Right", "الف", 0, "هوش مصنوعی: آسمان\r\nپر است."),
      verse(2, "Left", "ب", 0),
      verse(3, "Right", "پ", 1, "معنی"),
      verse(4, "Left", "ت", 1),
      verse(5, "Right", "ج", 2, "هوش مصنوعی:  "),
      verse(6, "Left", "چ", 2),
    ]);
    expect(couplets[0]).toMatchObject({ meaning: "آسمان\nپر است.", ai: true });
    expect(couplets[1]?.ai).toBeUndefined();
    expect(couplets[2]?.meaning).toBeUndefined();
    expect(aiNote("هوش مصنوعی: خلاصه")).toEqual({ text: "خلاصه", ai: true });
  });

  it("puts paragraphs and single lines in the first slot, and drops comments", () => {
    expect(groupCouplets([verse(1, "Paragraph", "نثر", 0), verse(2, "Single", "آزاد", 1), verse(3, "Right", "الف", 2), verse(4, "Left", "ب", 2)])).toEqual([pair("نثر", ""), pair("آزاد", ""), pair("الف", "ب")]);
    expect(groupCouplets([verse(1, "Comment", "(از چاتلان قوش)"), verse(2, "Single", "الف", 0), verse(3, "Single", "ب", 1)])).toEqual([pair("الف", ""), pair("ب", "")]);
  });

  it("pairs centred verses and keeps two first-slot verses of one index apart", () => {
    expect(groupCouplets([verse(1, "CenteredVerse1", "الف", 0), verse(2, "CenteredVerse2", "ب", 0)])).toEqual([pair("الف", "ب")]);
    expect(groupCouplets([verse(1, "Single", "الف", 0), verse(2, "Single", "ب", 0)])).toEqual([pair("الف", ""), pair("ب", "")]);
  });

  it("reads verses in VOrder", () => {
    expect(groupCouplets([verse(2, "Left", "ب", 0), verse(1, "Right", "الف", 0)])).toEqual([pair("الف", "ب")]);
  });
});

describe("a raw ganjoor-data poem and category", () => {
  it("converts the poem (fixture of ganjoor-data's /hafez/ghazal/sh3)", () => {
    const poem = poemFromRaw(fixture("raw-poem-sh3"));
    expect(poem).toMatchObject({ id: 2132, title: "غزل شمارهٔ ۳", path: "/hafez/ghazal/sh3", summaryAi: true });
    expect(poem.rhythm).toContain("هزج مثمن سالم");
    expect(poem.summary?.startsWith("این غزل")).toBe(true);
    expect(poem.couplets[0]).toMatchObject({ m1: "اگر آن تُرکِ شیرازی به‌‌ دست‌ آرَد دلِ ما را" });
    expect(poem.couplets[0]?.ai).toBeUndefined();
    expect(poem.couplets[0]?.meaning).toContain("\n");
    expect(poem.couplets.every((couplet) => couplet.m1 && couplet.m2)).toBe(true);
  });

  it("converts a small poem with AI notes (fixture of /hafez/ghete/sh1)", () => {
    const poem = poemFromRaw(fixture("raw-poem-ghete1"));
    expect(poem.couplets).toHaveLength(2);
    expect(poem.couplets.map((couplet) => couplet.ai)).toEqual([true, undefined]);
    expect(poem.couplets[1]?.meaning?.startsWith("و هرکس")).toBe(true);
  });

  it("converts the category into a book with its poem list and sub-books", () => {
    expect(bookFromRaw(fixture("raw-category-ghete"))).toEqual({
      id: 25, title: "قطعات", path: "/hafez/ghete", poetId: 2, toc: "AlphabeticWithFirstCouplet",
      poems: [{ id: 2093, title: "قطعه شمارهٔ ۱", path: "/hafez/ghete/sh1" }, { id: 2094, title: "قطعه شمارهٔ ۲", path: "/hafez/ghete/sh2" }],
      children: [{ id: 9999, title: "زیربخش آزمایشی", path: "/hafez/ghete/zir" }],
    });
  });
});

describe("the bundled files", () => {
  it("reads poets.json: the pinned commit and the three bundled books", () => {
    const file = bundledFile<PoetsFile>("poets");
    expect(file.source.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(file.poets.flatMap((poet) => poet.books).filter((book) => book.bundled).map((book) => book.path)).toEqual(["/hafez/ghazal", "/khayyam/robaee", "/babataher/2beytiha"]);
  });

  it("reads Hafez's book: the book keeps only the poems' id, title and path, the text is beside it", () => {
    const { book, poems } = bundledBook(bundledFile("book-24"));
    expect(book).toMatchObject({ id: 24, path: "/hafez/ghazal", children: [] });
    expect(book.poems[2]).toEqual({ id: 2132, title: "غزل شمارهٔ ۳", path: "/hafez/ghazal/sh3" });
    const sh3 = poems.find((poem) => poem.path === "/hafez/ghazal/sh3")!;
    expect(sh3.couplets).toHaveLength(9);
    expect(sh3.couplets[1]).toMatchObject({ m1: expect.stringContaining("بده ساقی"), meaning: expect.any(String) });
  });
});

describe("PoetryStore", () => {
  const poets = bundledFile<PoetsFile>("poets");
  const bundled: BundledSource = { poets: async () => poets, book: async (id) => bundledBook(bundledFile(`book-${id}`)) };
  const memory = (): PoetryCache & { items: Map<string, unknown> } => {
    const items = new Map<string, unknown>();
    return { items, read: async <T,>(key: string) => items.get(key) as T | undefined, write: async (key, value) => void items.set(key, value) };
  };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const open = (fetcher: typeof fetch, cache = memory()) => PoetryStore.open({ bundled, fetch: fetcher, cache: () => cache });

  it("serves a poem of a bundled book without the network", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const store = await open(fetcher);
    expect((await store.poem("/hafez/ghazal/sh3")).couplets).toHaveLength(9);
    expect((await store.book("/hafez/ghazal")).title).toBe("غزلیات");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fetches any other poem from ganjoor-data at the pinned commit, and caches it", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json(fixture("raw-poem-ghete1")));
    const cache = memory();
    const store = await open(fetcher, cache);
    const poem = await store.poem("/hafez/ghete/sh1");
    expect(poem.couplets).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledWith(`https://raw.githubusercontent.com/ganjoor/ganjoor-data/${poets.source.sha}/poets/hafez/ghete/sh1.json`);
    expect(cache.items.has("poets/hafez/ghete/sh1.json")).toBe(true);

    // Reopened with no network: the cache answers.
    const offline = vi.fn<typeof fetch>(async () => Promise.reject(new TypeError("offline")));
    expect(await (await open(offline, cache)).poem("/hafez/ghete/sh1")).toEqual(poem);
    expect(offline).not.toHaveBeenCalled();
  });

  it("fetches a book's _cat.json", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json(fixture("raw-category-ghete")));
    const book = await (await open(fetcher)).book("/hafez/ghete");
    expect(book.poems).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledWith(expect.stringMatching(/\/poets\/hafez\/ghete\/_cat\.json$/));
  });

  it("says not found for a 404, bad status for another, and lets a network failure through", async () => {
    await expect((await open(async () => json({}, 404))).poem("/x/y/z")).rejects.toMatchObject({ kind: "notFound" });
    await expect((await open(async () => json({}, 503))).poem("/x/y/z")).rejects.toMatchObject({ kind: "badStatus", status: 503 });
    await expect((await open(async () => Promise.reject(new TypeError("offline")))).poem("/x/y/z")).rejects.toBeInstanceOf(TypeError);
    expect(new PoetryError("notFound", "x").kind).toBe("notFound");
  });

  it("refuses a path that could point outside ganjoor-data", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const store = await open(fetcher);
    for (const path of ["poets/x", "/a/../b", "/a//b", "/a/./b", "/"]) await expect(store.poem(path)).rejects.toMatchObject({ kind: "notFound" });
    expect(isValidPath("/hafez/ghazal/sh3")).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("asks Ganjoor live for the recitations, in Ganjoor's order, with an empty timing url as none", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json(fixture("recitations")));
    const list = await (await open(fetcher)).recitations(2132);
    expect(fetcher).toHaveBeenCalledWith("https://api.ganjoor.net/api/ganjoor/poem/2132/recitations");
    expect(list.map((item) => item.audioOrder)).toEqual([1, 2, 3]);
    expect(list[0]).toMatchObject({ id: 2842, inSyncWithText: true, xmlUrl: "https://i.ganjoor.net/a/x/2132-ff.xml" });
    expect(list[2]?.xmlUrl).toBeUndefined();
  });

  it("finds a poem's poet by the slug that starts its path", async () => {
    const store = await open(vi.fn<typeof fetch>());
    expect(store.poetOf("/hafez/ghazal/sh3")?.nickname).toBe("حافظ");
    expect(store.poetOf("/nobody/x/y")).toBeUndefined();
  });
});
