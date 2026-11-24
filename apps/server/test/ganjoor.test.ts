import { describe, expect, it, vi } from "vitest";
import { createGanjoor, groupCouplets, POEM_CACHE_SIZE } from "../src/ganjoor.js";
import { loadGameData } from "../src/gameData.js";

const data = loadGameData();
const SHA = data.sha;

const verse = (VOrder: number, Position: string, Text: string, CoupletIndex: number | null = null) => ({ VOrder, Position, Text, CoupletIndex });
const poemJson = (...verses: ReturnType<typeof verse>[]) => new Response(JSON.stringify({ Verses: verses }), { status: 200 });

describe("groupCouplets", () => {
  it("pairs Right with Left and CenteredVerse1 with CenteredVerse2, in verse order", () => {
    expect(
      groupCouplets([verse(2, "Left", "ب", 0), verse(1, "Right", "الف", 0), verse(3, "CenteredVerse1", "ج", 1), verse(4, "CenteredVerse2", "د", 1)]),
    ).toEqual([
      { m1: "الف", m2: "ب" },
      { m1: "ج", m2: "د" },
    ]);
  });
  it("drops Comment verses", () => {
    expect(groupCouplets([verse(1, "Right", "الف", 0), verse(2, "Comment", "یادداشت", null), verse(3, "Left", "ب", 0)])).toEqual([{ m1: "الف", m2: "ب" }]);
  });
  it("makes a Single or Paragraph verse a couplet of its own, and starts a new couplet when a slot would repeat", () => {
    expect(groupCouplets([verse(1, "Paragraph", "یک", 0), verse(2, "Single", "دو", 1), verse(3, "Single", "سه", 1)])).toEqual([
      { m1: "یک", m2: "" },
      { m1: "دو", m2: "" },
      { m1: "سه", m2: "" },
    ]);
  });
  it("strips carriage returns", () => {
    expect(groupCouplets([verse(1, "Right", "الف\r", 0)])).toEqual([{ m1: "الف", m2: "" }]);
  });
});

describe("the Ganjoor fetch", () => {
  const make = (handler: () => Response | Promise<Response>) => {
    const fetchMock = vi.fn<typeof fetch>(async () => handler());
    return { fetchMock, ganjoor: createGanjoor({ fetch: fetchMock, data }) };
  };

  it("reads a poem at the pinned commit and finds a couplet by key", async () => {
    const { fetchMock, ganjoor } = make(() => poemJson(verse(1, "Right", "الف", 0), verse(2, "Left", "ب", 0), verse(3, "Right", "ج", 1), verse(4, "Left", "د", 1)));
    expect(await ganjoor.couplet("/hafez/ghazal/sh3#1")).toEqual({ m1: "ج", m2: "د" });
    expect(String(fetchMock.mock.calls[0]![0])).toBe(`https://raw.githubusercontent.com/ganjoor/ganjoor-data/${SHA}/poets/hafez/ghazal/sh3.json`);
    expect(await ganjoor.couplet("/hafez/ghazal/sh3#2")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("answers null for a poem that does not exist, and never fetches a path with an empty part", async () => {
    const { fetchMock, ganjoor } = make(() => new Response("", { status: 404 }));
    expect(await ganjoor.couplet("/nobody/none#0")).toBeNull();
    expect(await ganjoor.couplet("/a//b#0")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is 503 unavailable when GitHub fails, answers badly or is too slow, and does not keep the failure", async () => {
    let mode: "error" | "bad" | "json" | "ok" = "error";
    const { fetchMock, ganjoor } = make(() => {
      if (mode === "error") return new Response("", { status: 500 });
      if (mode === "bad") return new Response("not json", { status: 200 });
      if (mode === "json") return new Response('{"x":1}', { status: 200 });
      return poemJson(verse(1, "Right", "الف", 0));
    });
    for (mode of ["error", "bad", "json"] as const) await expect(ganjoor.poem("/a/b")).rejects.toMatchObject({ status: 503, code: "unavailable" });
    mode = "ok";
    expect(await ganjoor.poem("/a/b")).toEqual([{ m1: "الف", m2: "" }]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("gives the fetch a 5 second timeout and turns a network error into unavailable", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      throw new DOMException("timeout", "TimeoutError");
    });
    await expect(createGanjoor({ fetch: fetchMock, data }).poem("/a/b")).rejects.toMatchObject({ status: 503 });
  });

  it("keeps 500 poems and drops the least recently used", async () => {
    const { fetchMock, ganjoor } = make(() => poemJson(verse(1, "Right", "الف", 0)));
    for (let i = 0; i < POEM_CACHE_SIZE; i++) await ganjoor.poem(`/p/${i}`);
    await ganjoor.poem("/p/0"); // used again: now the newest
    await ganjoor.poem("/p/new"); // pushes out /p/1
    expect(fetchMock).toHaveBeenCalledTimes(POEM_CACHE_SIZE + 1);
    await ganjoor.poem("/p/0");
    expect(fetchMock).toHaveBeenCalledTimes(POEM_CACHE_SIZE + 1);
    await ganjoor.poem("/p/1");
    expect(fetchMock).toHaveBeenCalledTimes(POEM_CACHE_SIZE + 2);
  });

  it("asks once for a poem asked for twice at the same time", async () => {
    const { fetchMock, ganjoor } = make(() => poemJson(verse(1, "Right", "الف", 0)));
    await Promise.all([ganjoor.poem("/a/b"), ganjoor.poem("/a/b")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("the game data", () => {
  it("loads the deck, the poets, the books and the commit", () => {
    expect(data.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(data.deck.length).toBeGreaterThan(1000);
    expect(data.byKey.get("/hafez/ghazal/sh3#0")).toMatchObject({ poet: "hafez", book: "/hafez", bookTitle: "دیوان حافظ" });
    expect(data.poets.find((p) => p.slug === "saadi")).toMatchObject({ name: "سعدی" });
    expect(data.books.filter((b) => b.poet === "saadi").length).toBeGreaterThan(1);
  });
});
