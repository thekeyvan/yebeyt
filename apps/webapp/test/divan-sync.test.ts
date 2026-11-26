import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DivanSync } from "../lib/account/divanSync";
import type { DivanItem } from "../lib/reader/divan";
import { divanKey, ReaderMarks } from "../lib/reader/marks";
import { offline, sessionOf } from "./account";
import { memoryStorage } from "./storage";

/** A server that keeps a divan and merges what it is sent, the later of each time (as the real one does). */
function divanServer(start: DivanItem[] = []) {
  const stored = new Map(start.map((item) => [item.key, item]));
  const later = (a?: number, b?: number) => (a === undefined ? b : b === undefined ? a : Math.max(a, b));
  const api = {
    divan: vi.fn(async () => [...stored.values()]),
    putDivan: vi.fn(async (items: DivanItem[]) => {
      for (const item of items) {
        const known = stored.get(item.key);
        stored.set(item.key, { key: item.key, keptAt: later(known?.keptAt, item.keptAt), removedAt: later(known?.removedAt, item.removedAt) });
      }
      return [...stored.values()];
    }),
  };
  return { api, stored };
}

const kept = (key: string, keptAt: number, removedAt?: number): DivanItem => ({ key, keptAt, removedAt });

describe("the divan in ReaderMarks (Reader/ReaderMarks.swift, Me/Divan/DivanItem.swift)", () => {
  it("merges what the server has: the later of each time wins", () => {
    const marks = new ReaderMarks(memoryStorage(), () => 5_000);
    marks.toggle("kept", "/a/b", 0); // kept at 5000
    marks.applyDivan([kept("/a/b#0", 3_000, 9_000), kept("/c/d#1", 1_000)]);
    expect(marks.divanItems()).toEqual([
      { key: "/a/b#0", keptAt: 5_000, removedAt: 9_000 },
      { key: "/c/d#1", keptAt: 1_000, removedAt: undefined },
    ]);
    expect([...marks.keys("kept")]).toEqual(["/c/d#1"]); // the removal at 9000 is later than the keep at 5000
  });

  it("keeps the merge across a reload, with the times as ISO strings", () => {
    const storage = memoryStorage();
    new ReaderMarks(storage).applyDivan([kept("/a/b#0", 2_000)]);
    expect(JSON.parse(storage.getItem(divanKey)!)).toEqual([{ key: "/a/b#0", keptAt: "1970-01-01T00:00:02.000Z" }]);
    expect(new ReaderMarks(storage).divanItems()).toEqual([{ key: "/a/b#0", keptAt: 2_000, removedAt: undefined }]);
  });

  it("clears the divan with its times", () => {
    const storage = memoryStorage();
    const marks = new ReaderMarks(storage);
    marks.toggle("kept", "/a/b", 0);
    marks.clearDivan();
    expect(marks.divanItems()).toEqual([]);
    expect(storage.getItem(divanKey)).toBeNull();
  });

  it("tells when the person keeps or un-keeps, and not after a merge", () => {
    const marks = new ReaderMarks(memoryStorage());
    const told = vi.fn();
    marks.onKeptChange = told;
    marks.toggle("kept", "/a/b", 0);
    marks.toggle("liked", "/a/b", 0);
    marks.applyDivan([kept("/x/y#1", 1)]);
    expect(told).toHaveBeenCalledTimes(1);
  });
});

describe("DivanSync (Me/Divan/DivanSync.swift)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const fixture = (server = divanServer(), signedIn = true) => {
    const marks = new ReaderMarks(memoryStorage(), () => 2_000);
    return { marks, server, sync: new DivanSync(marks, sessionOf(signedIn), server.api, 600) };
  };

  it("never touches the server for a guest", async () => {
    const f = fixture(undefined, false);
    f.marks.toggle("kept", "/a/b/c", 0);
    await f.sync.syncNow();
    expect(f.server.api.divan).not.toHaveBeenCalled();
    expect([...f.marks.keys("kept")]).toEqual(["/a/b/c#0"]);
  });

  it("pulls the server's divan when signing in and pushes only what the server lacks", async () => {
    const f = fixture(divanServer([kept("/hafez/ghazal/sh1#0", Date.parse("2026-11-20T10:00:00.000Z"))]));
    f.marks.toggle("kept", "/saadi/g/sh2", 1); // kept as a guest at 2000 ms
    await f.sync.syncNow();
    expect([...f.marks.keys("kept")].sort()).toEqual(["/hafez/ghazal/sh1#0", "/saadi/g/sh2#1"]);
    expect(f.server.api.putDivan).toHaveBeenCalledTimes(1);
    expect(f.server.api.putDivan.mock.calls[0]![0]).toEqual([{ key: "/saadi/g/sh2#1", keptAt: 2_000, removedAt: undefined }]);
  });

  it("pushes nothing when this browser and the server agree", async () => {
    const f = fixture(divanServer([kept("/a/b/c#0", 2_000)]));
    f.marks.toggle("kept", "/a/b/c", 0);
    await f.sync.syncNow();
    expect(f.server.api.putDivan).not.toHaveBeenCalled();
  });

  it("lets a later removal elsewhere win", async () => {
    const f = fixture(divanServer([kept("/a/b/c#0", 1_000, Date.parse("2026-11-22T00:00:00.000Z"))]));
    f.marks.applyDivan([kept("/a/b/c#0", 2_000)]);
    await f.sync.syncNow();
    expect(f.marks.keys("kept").size).toBe(0);
    expect(f.marks.divanItems()[0]!.removedAt).toBeDefined();
  });

  it("pushes a big divan in batches of two thousand", async () => {
    const f = fixture();
    f.marks.applyDivan(Array.from({ length: 4_500 }, (_, index) => kept(`/a/b/c#${index}`, 2_000)));
    await f.sync.syncNow();
    expect(f.server.api.putDivan.mock.calls.map(([batch]) => batch.length)).toEqual([2_000, 2_000, 500]);
  });

  it("keeps the local divan when the sync fails, and says so", async () => {
    const f = fixture();
    f.server.api.divan.mockRejectedValue(offline());
    f.marks.toggle("kept", "/a/b/c", 0);
    expect(await f.sync.syncNow()).toBe(false);
    expect([...f.marks.keys("kept")]).toEqual(["/a/b/c#0"]);
  });

  it("runs once after the debounce, however often it is asked", async () => {
    const f = fixture();
    f.marks.toggle("kept", "/a/b/c", 0);
    f.sync.scheduleSync();
    f.sync.scheduleSync();
    f.sync.scheduleSync();
    expect(f.server.api.divan).not.toHaveBeenCalled(); // not at once
    await vi.advanceTimersByTimeAsync(700);
    expect(f.server.api.divan).toHaveBeenCalledTimes(1);
    expect(f.server.api.putDivan).toHaveBeenCalledTimes(1);
  });

  it("is scheduled by keeping a couplet", async () => {
    const f = fixture();
    f.marks.toggle("kept", "/a/b/c", 4);
    await vi.advanceTimersByTimeAsync(700);
    expect(f.server.api.putDivan).toHaveBeenCalled();
  });

  it("goes around once more when asked while it runs, and the waiting call shares its result", async () => {
    const f = fixture();
    let release: () => void = () => {};
    f.server.api.divan.mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve([]))));
    const first = f.sync.syncNow();
    const second = f.sync.syncNow();
    await vi.advanceTimersByTimeAsync(0);
    release();
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(f.server.api.divan).toHaveBeenCalledTimes(2);
  });

  it("is stopped by a clear: a waiting sync is cancelled", async () => {
    const f = fixture();
    f.marks.toggle("kept", "/a/b/c", 0);
    await f.sync.stop();
    await vi.advanceTimersByTimeAsync(700);
    expect(f.server.api.divan).not.toHaveBeenCalled();
  });
});
