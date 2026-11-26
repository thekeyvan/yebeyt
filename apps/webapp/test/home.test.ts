import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeModel, rejectedKey } from "../lib/library/home";
import { BookIndexes } from "../lib/library/indexes";
import { candidates, pick, poemLimit, preferring, type Candidate } from "../lib/library/dailyPick";
import type { IndexedPoem } from "../lib/library/bookIndex";
import { dateLine, dayNumber } from "../lib/library/date";
import { Library } from "../lib/library/library";
import type { LibraryFile } from "../lib/library/models";
import { homeSource } from "../lib/library/sources";
import { bundledBook } from "../lib/poetry/bundled";
import type { PoetsFile } from "../lib/poetry/models";
import { PoetryStore } from "../lib/poetry/store";
import { bundledFile } from "./files";
import { today } from "../lib/library/today";
import { memoryStorage } from "./storage";

// The tests of YebeytTests/HomeTests.swift and FollowsAndHomeModelTests.swift (HomeModel).
const indexed = (path: string, couplets: number, recitations: number): IndexedPoem => ({ id: 1, catId: 1, path, first: "", couplets, rhyme: "", recitations, number: 1, searchText: "", rhymeKey: [] });

describe("the candidates of the daily couplet", () => {
  it("are the couplets of the most recited poems, most recited first", () => {
    const poems = [indexed("/a/1", 2, 3), indexed("/a/2", 3, 9), indexed("/a/3", 4, 0)];
    expect(candidates(poems)).toEqual([
      { path: "/a/2", couplet: 0 },
      { path: "/a/2", couplet: 1 },
      { path: "/a/2", couplet: 2 },
      { path: "/a/1", couplet: 0 },
      { path: "/a/1", couplet: 1 },
    ]); // the poem nobody recited is not popular
  });

  it("count only the top poems", () => {
    const poems = Array.from({ length: 150 }, (_, i) => indexed(`/a/${i + 1}`, 1, i + 1));
    const list = candidates(poems);
    expect(list).toHaveLength(poemLimit);
    expect(list[0]?.path).toBe("/a/150");
  });

  it("break ties by path", () => {
    expect(candidates([indexed("/a/2", 1, 5), indexed("/a/1", 1, 5)]).map((c) => c.path)).toEqual(["/a/1", "/a/2"]);
  });

  it("prefer the poets of the taste, when any poem is by one of them", () => {
    const poems = [indexed("/hafez/g/1", 1, 1), indexed("/saadi/g/1", 1, 1)];
    expect(preferring(new Set(["saadi"]), poems).map((p) => p.path)).toEqual(["/saadi/g/1"]);
    expect(preferring(new Set(["nima"]), poems)).toEqual(poems);
    expect(preferring(new Set(), poems)).toEqual(poems);
  });
});

describe("the pick of a day", () => {
  const list: Candidate[] = Array.from({ length: 120 }, (_, i) => ({ path: `/a/${Math.floor(i / 10)}`, couplet: i % 10 }));

  it("is always the same couplet for a day", () => {
    expect(pick(739_000, 0, list)).toEqual(pick(739_000, 0, list));
    expect(pick(739_000, 0, list)).toBeDefined();
  });

  it("usually differs from day to day", () => {
    const picks = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(pick(739_000 + i, 0, list))));
    expect(picks.size).toBeGreaterThan(20);
  });

  it("shows the next candidate for each reject, none twice before all are shown", () => {
    const sequence = list.map((_, rejected) => pick(739_000, rejected, list));
    expect(new Set(sequence.map((c) => JSON.stringify(c))).size).toBe(list.length);
    expect(sequence[0]).not.toEqual(sequence[1]);
    expect(pick(739_000, 5, list)).toEqual(sequence[5]);
  });

  it("is nothing without candidates, and the only one with one", () => {
    expect(pick(1, 0, [])).toBeUndefined();
    const only = [{ path: "/a/1", couplet: 0 }];
    expect(pick(5, 3, only)).toEqual(only[0]);
  });
});

describe("the day and the date line (Tehran, as the whole app counts days)", () => {
  it("changes the day number at Tehran's midnight", () => {
    const before = new Date("2026-11-22T20:29:00Z"); // 23:59 in Tehran
    const after = new Date("2026-11-22T20:31:00Z"); // 00:01 on the 23rd
    expect(dayNumber(after)).toBe(dayNumber(before) + 1);
    expect(dayNumber(new Date("1970-01-01T12:00:00Z"))).toBe(0);
  });

  it("can count by another time zone, as the phone's local midnight", () => {
    const before = new Date("2026-11-22T22:59:00Z"); // 23:59 in Berlin
    expect(dayNumber(new Date("2026-11-22T23:01:00Z"), "Europe/Berlin")).toBe(dayNumber(before, "Europe/Berlin") + 1);
  });

  it("writes the weekday, day and month in the Persian calendar", () => {
    const monday = new Date("2026-11-23T11:00:00Z");
    expect(dateLine(monday, "Europe/Berlin")).toBe("دوشنبه ۲ آذر");
    expect(dateLine(new Date("2026-11-15T09:00:00Z"))).toBe("یکشنبه ۲۴ آبان");
  });
});

describe("HomeModel", () => {
  const library = new Library(bundledFile<LibraryFile>("library"));
  const source = async () => {
    const poetry = await PoetryStore.open({ bundled: { poets: async () => bundledFile<PoetsFile>("poets"), book: async (id) => bundledBook(bundledFile(`book-${id}`)) } });
    return homeSource(library, new BookIndexes(async (name) => bundledFile(name)), poetry);
  };
  const same = (a?: { path: string; index: number }, b?: { path: string; index: number }) => a?.path === b?.path && a?.index === b?.index;

  it("shows a couplet of a bundled book and names its poet", async () => {
    const home = new HomeModel(20_500, memoryStorage(), await source());
    expect(home.snapshot().pick).toBeUndefined();
    await home.load();
    const { pick: today } = home.snapshot();
    expect(today?.path).toMatch(/^\/(hafez\/ghazal|khayyam\/robaee|babataher\/2beytiha)\//);
    expect(today?.couplet.m1).not.toBe("");
    expect(today?.poet).not.toBe("");
    expect(today?.title).not.toBe("");
  });

  it("shows the same couplet on the same day", async () => {
    const first = new HomeModel(20_500, memoryStorage(), await source());
    await first.load();
    const second = new HomeModel(20_500, memoryStorage(), await source());
    await second.load();
    expect(same(first.snapshot().pick, second.snapshot().pick)).toBe(true);
  });

  it("shows another couplet after a reject and remembers it for the day", async () => {
    const storage = memoryStorage();
    const home = new HomeModel(20_500, storage, await source());
    await home.load();
    const before = home.snapshot().pick;
    await home.reject();
    const after = home.snapshot();
    expect(after.rejected).toBe(1);
    expect(same(before, after.pick)).toBe(false);
    const reopened = new HomeModel(20_500, storage, await source());
    expect(reopened.snapshot().rejected).toBe(1);
    await reopened.load();
    expect(same(reopened.snapshot().pick, after.pick)).toBe(true);
  });

  it("shows the same couplet again when a reject is taken back, and remembers that", async () => {
    const storage = memoryStorage();
    const home = new HomeModel(20_500, storage, await source());
    await home.load();
    const first = home.snapshot().pick;
    await home.reject();
    await home.undoReject(20_500);
    expect(home.snapshot().rejected).toBe(0);
    expect(same(home.snapshot().pick, first)).toBe(true);
    expect(new HomeModel(20_500, storage, await source()).snapshot().rejected).toBe(0);
    await home.undoReject(20_500); // nothing to take back
    expect(home.snapshot().rejected).toBe(0);
  });

  it("cannot take back a reject of yesterday today", async () => {
    const storage = memoryStorage();
    const home = new HomeModel(20_500, storage, await source());
    await home.load();
    await home.reject();
    await home.refresh(20_501);
    await home.undoReject(20_500);
    expect(home.snapshot()).toMatchObject({ day: 20_501, rejected: 0 });
    expect(new HomeModel(20_500, storage, await source()).snapshot().rejected).toBe(1);
  });

  it("shows the couplet of the new day, without rejects, when the page comes back after midnight", async () => {
    const storage = memoryStorage();
    const home = new HomeModel(20_500, storage, await source());
    await home.load();
    await home.reject();
    await home.refresh(20_500); // the same day changes nothing
    expect(home.snapshot()).toMatchObject({ rejected: 1, day: 20_500 });
    await home.refresh(20_501);
    expect(home.snapshot()).toMatchObject({ day: 20_501, rejected: 0 });
    const fresh = new HomeModel(20_501, storage, await source());
    await fresh.load();
    expect(same(home.snapshot().pick, fresh.snapshot().pick)).toBe(true);
  });

  it("starts a new day without rejects, from the saved [day, count]", () => {
    const storage = memoryStorage({ [rejectedKey]: JSON.stringify([20_500, 3]) });
    const noSource = { poems: async () => [], pick: async () => undefined };
    expect(new HomeModel(20_500, storage, noSource).snapshot().rejected).toBe(3);
    expect(new HomeModel(20_501, storage, noSource).snapshot().rejected).toBe(0);
  });

  it("prefers the poets of the taste once onboarding has saved them", async () => {
    const home = new HomeModel(20_500, memoryStorage({ "taste.poets": JSON.stringify(["khayyam"]) }), await source());
    await home.load();
    expect(home.snapshot().pick?.path).toMatch(/^\/khayyam\//);
  });
});

describe("the day a debug build can be told it is (-beytToday)", () => {
  afterEach(() => vi.unstubAllEnvs());
  const told = (key: string | null) => ({ getItem: () => key });

  it("is the day in sessionStorage, at noon in Tehran, while developing", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(today(told("2026-11-23")).toISOString()).toBe("2026-11-23T08:30:00.000Z");
    expect(dayNumber(today(told("2026-11-23")))).toBe(dayNumber(new Date("2026-11-23T10:00:00+03:30")));
  });

  it("is now when it is told nothing or something that is no date", () => {
    vi.stubEnv("NODE_ENV", "development");
    for (const key of [null, "tomorrow", "2026-1-2"]) expect(Math.abs(today(told(key)).getTime() - Date.now())).toBeLessThan(1000);
  });

  it("is ignored in a production build without the dev pages", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEV_PAGES", "");
    expect(Math.abs(today(told("2026-11-23")).getTime() - Date.now())).toBeLessThan(1000);
    vi.stubEnv("NEXT_PUBLIC_DEV_PAGES", "1");
    expect(today(told("2026-11-23")).toISOString()).toBe("2026-11-23T08:30:00.000Z");
  });
});
