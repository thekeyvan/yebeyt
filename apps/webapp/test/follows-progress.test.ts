import { describe, expect, it, vi } from "vitest";
import { Follows, followsKey } from "../lib/library/follows";
import { apiBase, isSafe, minimumGap, PoetPictures, pictureURL, picturesKey } from "../lib/library/pictures";
import { ReadingProgress, progressKey } from "../lib/library/progress";
import { memoryStorage } from "./storage";

// The tests of YebeytTests/FollowsAndHomeModelTests.swift (Follows) and ReadingProgressTests.swift.
describe("Follows", () => {
  it("follows nothing at first", () => {
    const follows = new Follows(memoryStorage());
    expect(follows.contains({ kind: "poet", slug: "hafez" })).toBe(false);
    expect(follows.contains({ kind: "book", id: 9 })).toBe(false);
  });

  it("turns following on and off per item", () => {
    const follows = new Follows(memoryStorage());
    expect(follows.toggle({ kind: "poet", slug: "hafez" })).toBe(true);
    expect(follows.contains({ kind: "poet", slug: "hafez" })).toBe(true);
    expect(follows.contains({ kind: "poet", slug: "saadi" })).toBe(false);
    expect(follows.contains({ kind: "book", id: 9 })).toBe(false);
    expect(follows.toggle({ kind: "poet", slug: "hafez" })).toBe(false);
    expect(follows.contains({ kind: "poet", slug: "hafez" })).toBe(false);
  });

  it("keeps follows across a reload, as the phone's sorted list of keys", () => {
    const storage = memoryStorage();
    const follows = new Follows(storage);
    follows.toggle({ kind: "poet", slug: "hafez" });
    follows.toggle({ kind: "book", id: 9 });
    expect(JSON.parse(storage.getItem(followsKey)!)).toEqual(["book:9", "poet:hafez"]);
    const reopened = new Follows(storage);
    expect(reopened.contains({ kind: "poet", slug: "hafez" })).toBe(true);
    expect(reopened.contains({ kind: "book", id: 9 })).toBe(true);
  });

  it("tells the page when it changes", () => {
    const follows = new Follows(memoryStorage());
    const listener = vi.fn();
    follows.subscribe(listener);
    follows.toggle({ kind: "poet", slug: "hafez" });
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("ReadingProgress", () => {
  it("has read nothing at first", () => {
    const progress = new ReadingProgress(memoryStorage());
    expect(progress.last).toBeUndefined();
    expect(progress.isRead("/a/b/c") || progress.isInProgress("/a/b/c")).toBe(false);
  });

  it("has the poem opened last in progress", () => {
    const progress = new ReadingProgress(memoryStorage());
    progress.opened("/a/b/c", 2, 9, "غزل ۳");
    expect(progress.last).toEqual({ path: "/a/b/c", couplet: 2, title: "غزل ۳" });
    expect(progress.isInProgress("/a/b/c")).toBe(true);
    expect(progress.isRead("/a/b/c")).toBe(false);
    progress.opened("/a/b/d", 0, 5, "غزل ۴");
    expect(progress.isInProgress("/a/b/c")).toBe(false);
    expect(progress.isInProgress("/a/b/d")).toBe(true);
  });

  it("makes a poem read once its last couplet is reached, and it is still the one to continue from", () => {
    const progress = new ReadingProgress(memoryStorage());
    progress.opened("/a/b/c", 7, 9, "غزل ۳");
    expect(progress.isRead("/a/b/c")).toBe(false);
    progress.opened("/a/b/c", 8, 9, "غزل ۳");
    expect(progress.isRead("/a/b/c")).toBe(true);
    expect(progress.isInProgress("/a/b/c")).toBe(false);
    expect(progress.last?.path).toBe("/a/b/c");
  });

  it("stays read after going back", () => {
    const progress = new ReadingProgress(memoryStorage());
    progress.opened("/a/b/c", 8, 9, "غزل ۳");
    progress.opened("/a/b/c", 1, 9, "غزل ۳");
    expect(progress.isRead("/a/b/c")).toBe(true);
  });

  it("makes the end of the whole poem read, and all its couplets passed", () => {
    const storage = memoryStorage();
    const progress = new ReadingProgress(storage);
    progress.opened("/a/b/c", 0, 9, "غزل ۳");
    progress.reachedEnd("/a/b/c", 3);
    expect(progress.isRead("/a/b/c")).toBe(true);
    expect(JSON.parse(storage.getItem(progressKey)!).couplets.sort()).toEqual(["/a/b/c#0", "/a/b/c#1", "/a/b/c#2"]);
  });

  it("reads a one-couplet poem as read when opened", () => {
    const progress = new ReadingProgress(memoryStorage());
    progress.opened("/a/b/c", 0, 1, "رباعی ۱");
    expect(progress.isRead("/a/b/c")).toBe(true);
  });

  it("counts only the given poems", () => {
    const progress = new ReadingProgress(memoryStorage());
    for (const path of ["/a/b/1", "/a/b/2", "/x/y/1"]) progress.reachedEnd(path);
    expect(progress.readCount(["/a/b/1", "/a/b/2", "/a/b/3"])).toBe(2);
  });

  it("survives a reload, in the phone's JSON", () => {
    const storage = memoryStorage();
    const progress = new ReadingProgress(storage);
    progress.opened("/a/b/c", 1, 9, "غزل ۳");
    progress.reachedEnd("/a/b/d");
    expect(JSON.parse(storage.getItem(progressKey)!)).toEqual({
      last: { path: "/a/b/c", couplet: 1, title: "غزل ۳" },
      finished: ["/a/b/d"],
      couplets: ["/a/b/c#1"],
    });
    const reopened = new ReadingProgress(storage);
    expect(reopened.last?.couplet).toBe(1);
    expect(reopened.isInProgress("/a/b/c")).toBe(true);
    expect(reopened.isRead("/a/b/d")).toBe(true);
  });

  it("reads what the phone saved, which may have no couplets yet", () => {
    const saved = JSON.stringify({ last: { path: "/a/b/c", couplet: 4, title: "غزل ۳" }, finished: ["/a/b/d"] });
    const progress = new ReadingProgress(memoryStorage({ [progressKey]: saved }));
    expect(progress.last?.couplet).toBe(4);
    expect(progress.isRead("/a/b/d")).toBe(true);
  });

  it("starts empty from data that cannot be read", () => {
    expect(new ReadingProgress(memoryStorage({ [progressKey]: "not json" })).last).toBeUndefined();
    expect(new ReadingProgress(memoryStorage({ [progressKey]: '{"last":{"path":1}}' })).last).toBeUndefined();
  });
});

describe("PoetPictures (Library/PoetPictures.swift)", () => {
  const entry = { slug: "hafez", version: "ab12", url: "/v1/poets/hafez/picture?v=ab12" };
  const answer = (body: unknown, ok = true) => vi.fn(async () => (ok ? Response.json(body) : new Response("no", { status: 500 })));
  const clock = (start = 1_000_000) => {
    let now = start;
    return { now: () => now, advance: (seconds: number) => void (now += seconds * 1000) };
  };

  it("asks the server through the web app's own route, and draws pictures from it", async () => {
    const fetcher = answer([entry]);
    const pictures = new PoetPictures(memoryStorage(), fetcher);
    await pictures.refresh();
    expect(fetcher).toHaveBeenCalledWith(`${apiBase}/v1/poets/pictures`);
    expect(pictures.snapshot()).toEqual({ hafez: entry });
    expect(pictureURL(entry)).toBe("/api/v1/poets/hafez/picture?v=ab12");
  });

  it("does not ask again within a minute, but after it, and a new version replaces the old", async () => {
    const time = clock();
    const fetcher = answer([entry]);
    const pictures = new PoetPictures(memoryStorage(), fetcher, time.now);
    await pictures.refresh();
    time.advance(minimumGap - 1);
    await pictures.refresh();
    expect(fetcher).toHaveBeenCalledOnce();
    time.advance(2);
    fetcher.mockImplementation(async () => Response.json([{ ...entry, version: "cd34", url: "/v1/poets/hafez/picture?v=cd34" }]));
    await pictures.refresh();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(pictures.snapshot().hafez?.version).toBe("cd34");
  });

  it("counts a failed ask toward the minute, and keeps the list it had", async () => {
    const storage = memoryStorage();
    await new PoetPictures(storage, answer([entry])).refresh();
    const fetcher = answer(null, false);
    const pictures = new PoetPictures(storage, fetcher);
    expect(pictures.snapshot().hafez).toEqual(entry); // the saved list shows until the answer comes
    await pictures.refresh();
    await pictures.refresh();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(pictures.snapshot().hafez).toEqual(entry);
  });

  it("keeps the list when there is no network", async () => {
    const storage = memoryStorage({ [picturesKey]: JSON.stringify([entry]) });
    const pictures = new PoetPictures(storage, vi.fn(async () => { throw new TypeError("offline"); }));
    await pictures.refresh();
    expect(pictures.snapshot().hafez).toEqual(entry);
    expect(new PoetPictures(memoryStorage(), vi.fn()).snapshot()).toEqual({});
  });

  it("drops entries that could leave our server or hide a path", async () => {
    expect(isSafe(entry)).toBe(true);
    for (const bad of [{ ...entry, slug: "../x" }, { ...entry, slug: "" }, { ...entry, version: "a b" }, { ...entry, url: "//evil.example/x" }, { ...entry, url: "https://evil.example/x" }, { slug: 1 }, null]) {
      expect(isSafe(bad)).toBe(false);
    }
    const pictures = new PoetPictures(memoryStorage(), answer([entry, { ...entry, slug: "../x" }, { ...entry, slug: "b", url: "//evil.example/b" }]));
    await pictures.refresh();
    expect(Object.keys(pictures.snapshot())).toEqual(["hafez"]);
  });

  it("ignores an answer that is no list", async () => {
    const pictures = new PoetPictures(memoryStorage(), answer({ error: "x" }));
    await pictures.refresh();
    expect(pictures.snapshot()).toEqual({});
  });
});
