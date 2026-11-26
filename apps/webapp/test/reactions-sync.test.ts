import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MyReactions } from "../lib/account/api";
import { ReactionsSync } from "../lib/account/reactionsSync";
import { ReaderMarks } from "../lib/reader/marks";
import { offline, refused, sessionOf, settle } from "./account";
import { memoryStorage } from "./storage";

/** A server that keeps likes and reposts (Reader/ReactionsSyncTests.swift's `ReactionServer`). */
function reactionServer() {
  const stored = new Map<string, string>(); // "like|key" → time
  let pageSize = 200;
  const calls: string[] = [];
  const api = {
    setReaction: vi.fn(async (kind: string, key: string, on: boolean) => {
      calls.push(`${on ? "PUT" : "DELETE"} ${kind} ${key}`);
      if (on) stored.set(`${kind}|${key}`, "2026-11-21T08:00:00.000Z");
      else stored.delete(`${kind}|${key}`);
    }),
    myReactions: vi.fn(async (cursor?: string): Promise<MyReactions> => {
      const all = [...stored].sort(([a], [b]) => (a < b ? -1 : 1));
      const start = cursor === undefined ? 0 : Number(cursor);
      const items = all.slice(start, start + pageSize).map(([id, at]) => ({ key: id.split("|")[1]!, kind: id.split("|")[0] as "like" | "repost", at }));
      return { items, nextCursor: start + pageSize < all.length ? String(start + pageSize) : null };
    }),
  };
  return { api, calls, add: (kind: string, key: string) => void stored.set(`${kind}|${key}`, "2026-11-20T08:00:00.000Z"), has: (kind: string, key: string) => stored.has(`${kind}|${key}`), setPageSize: (n: number) => (pageSize = n) };
}

let storage: ReturnType<typeof memoryStorage>;
beforeEach(() => {
  storage = memoryStorage();
});

function fixture(signedIn = true, shared = storage) {
  const server = reactionServer();
  const session = sessionOf(signedIn);
  const marks = new ReaderMarks(shared);
  const sync = new ReactionsSync(marks, session, server.api, shared);
  return { server, session, marks, sync };
}

describe("ReactionsSync (Reader/ReactionsSync.swift)", () => {
  it("sends a like with its key (the percent-encoding is the client's)", async () => {
    const f = fixture();
    f.marks.toggle("liked", "/hafez/ghazal/sh3", 0);
    await f.sync.syncNow();
    expect(f.server.calls).toEqual(["PUT like /hafez/ghazal/sh3#0"]);
    expect(f.sync.hasUnsent).toBe(false);
  });

  it("takes back a repost with a delete", async () => {
    const f = fixture();
    f.server.add("repost", "/a/b#1");
    f.marks.toggle("reposted", "/a", 1);
    await f.sync.syncNow();
    f.marks.toggle("reposted", "/a", 1);
    await f.sync.syncNow();
    expect(f.server.calls).toEqual(["PUT repost /a#1", "DELETE repost /a#1"]);
  });

  it("keeps offline changes on disk, one per couplet and kind with the last state, and sends them later", async () => {
    const f = fixture();
    f.server.api.setReaction.mockRejectedValue(offline());
    f.marks.toggle("liked", "/a/b", 0);
    f.marks.toggle("liked", "/a/b", 0); // on, then off again
    f.marks.toggle("liked", "/a/b", 1);
    await f.sync.flush();
    expect(f.sync.hasUnsent).toBe(true);
    // A reload finds them.
    const reopened = new ReactionsSync(new ReaderMarks(storage), f.session, f.server.api, storage);
    expect(reopened.unsent).toHaveLength(2);
    f.server.api.setReaction.mockImplementation(async (kind, key, on) => void f.server.calls.push(`${on ? "PUT" : "DELETE"} ${kind} ${key}`));
    await f.sync.flush();
    expect(f.sync.hasUnsent).toBe(false);
    expect(f.server.calls.slice(-2)).toEqual(["DELETE like /a/b#0", "PUT like /a/b#1"]);
  });

  it("does not keep a guest's toggle", async () => {
    const f = fixture(false);
    f.marks.toggle("liked", "/a/b", 0);
    await f.sync.syncNow();
    expect(f.sync.hasUnsent).toBe(false);
    expect(f.server.api.setReaction).not.toHaveBeenCalled();
    expect(f.server.api.myReactions).not.toHaveBeenCalled();
  });

  it("drops a change the server refuses for good, and keeps one that failed to be retried", async () => {
    const f = fixture();
    f.server.api.setReaction.mockRejectedValue(refused(503, "unavailable"));
    f.marks.toggle("liked", "/a/b", 0);
    await f.sync.flush();
    expect(f.sync.hasUnsent).toBe(true);
    f.server.api.setReaction.mockRejectedValue(refused(400));
    await f.sync.flush();
    expect(f.sync.hasUnsent).toBe(false);
  });

  it("pulls the server's reactions when signing in, and the server wins", async () => {
    const f = fixture();
    f.server.add("like", "/hafez/ghazal/sh3#0");
    f.server.add("repost", "/hafez/ghazal/sh3#0");
    f.server.add("like", "/saadi/ghazal/sh1#4");
    // A like already here that this account never made is not uploaded, and goes.
    const phone = memoryStorage();
    const marks = new ReaderMarks(phone);
    marks.toggle("liked", "/stale/like", 3);
    const sync = new ReactionsSync(marks, sessionOf(), f.server.api, phone);
    expect(await sync.syncNow()).toBe(true);
    expect([...marks.keys("liked")].sort()).toEqual(["/hafez/ghazal/sh3#0", "/saadi/ghazal/sh1#4"]);
    expect([...marks.keys("reposted")]).toEqual(["/hafez/ghazal/sh3#0"]);
    expect(f.server.api.setReaction).not.toHaveBeenCalled();
  });

  it("uploads the likes made while signed in as this same account on the first pull", async () => {
    const f = fixture();
    f.server.api.setReaction.mockRejectedValue(offline()); // the like could not be sent at the time
    f.marks.toggle("liked", "/mine/a", 0);
    await f.sync.flush();
    storage.setItem("reader.reactions.unsent", "[]"); // as if the queue were lost; the owner is still known
    const server = reactionServer();
    const again = new ReactionsSync(new ReaderMarks(storage), f.session, server.api, storage);
    expect(await again.syncNow()).toBe(true);
    expect(server.has("like", "/mine/a#0")).toBe(true);
  });

  it("keeps a change that is still unsent through the pull", async () => {
    const f = fixture();
    f.server.add("like", "/a/b#0"); // liked on another device
    f.server.add("like", "/a/b#1");
    await f.sync.syncNow();
    expect([...f.marks.keys("liked")].sort()).toEqual(["/a/b#0", "/a/b#1"]);
    f.server.api.setReaction.mockRejectedValue(offline());
    f.marks.toggle("liked", "/a/b", 1); // #1 is on the server, so this turns it off here…
    f.marks.toggle("liked", "/a/b", 2); // …and #2 is liked here; neither could be sent
    expect(await f.sync.syncNow()).toBe(false); // unsent changes are left
    expect([...f.marks.keys("liked")].sort()).toEqual(["/a/b#0", "/a/b#2"]);
  });

  it("reads every page of the pull", async () => {
    const f = fixture();
    f.server.setPageSize(2);
    for (let index = 0; index < 5; index++) f.server.add("like", `/a/b#${index}`);
    await f.sync.syncNow();
    expect(f.marks.keys("liked").size).toBe(5);
    expect(f.server.api.myReactions).toHaveBeenCalledTimes(3);
  });

  it("drops a change that belongs to another account", async () => {
    const f = fixture();
    f.server.api.setReaction.mockRejectedValue(offline());
    f.marks.toggle("liked", "/a/b", 0);
    await f.sync.flush();
    f.server.api.setReaction.mockClear();
    const other = new ReactionsSync(new ReaderMarks(storage), sessionOf(true, "someone-else"), f.server.api, storage);
    await other.flush();
    expect(other.hasUnsent).toBe(false);
    expect(f.server.api.setReaction).not.toHaveBeenCalled();
  });

  it("sends only one flush at a time, and waits for it", async () => {
    const f = fixture();
    let release: () => void = () => {};
    f.server.api.setReaction.mockImplementation(() => new Promise<void>((resolve) => (release = resolve)));
    f.marks.toggle("liked", "/a/b", 0);
    const first = f.sync.flush();
    const second = f.sync.flush();
    await settle();
    expect(f.server.api.setReaction).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    expect(f.sync.hasUnsent).toBe(false);
  });

  it("forgets what is unsent when it is cleared", async () => {
    const f = fixture();
    f.server.api.setReaction.mockRejectedValue(offline());
    f.marks.toggle("liked", "/a/b", 0);
    await f.sync.flush();
    f.sync.clear();
    expect(f.sync.hasUnsent).toBe(false);
    expect(new ReactionsSync(new ReaderMarks(storage), f.session, f.server.api, storage).hasUnsent).toBe(false);
  });

  it("shares what is unsent between two tabs: neither overwrites the other's changes, and once one has sent them the other does not send them again", async () => {
    const tabA = fixture(true, storage);
    const tabB = fixture(true, storage); // opened before the first change was made
    tabA.server.api.setReaction.mockRejectedValue(offline());
    tabB.server.api.setReaction.mockRejectedValue(offline());
    tabA.marks.toggle("liked", "/a/b", 1);
    tabB.marks.toggle("reposted", "/c/d", 2);
    await settle();
    expect(tabA.sync.unsent.map((change) => `${change.kind} ${change.key}`)).toEqual(["like /a/b#1", "repost /c/d#2"]);
    expect(tabB.sync.unsent).toEqual(tabA.sync.unsent);
    tabB.server.api.setReaction.mockImplementation(async (kind: string, key: string, on: boolean) => void tabB.server.calls.push(`${on ? "PUT" : "DELETE"} ${kind} ${key}`));
    await tabB.sync.flush();
    expect(tabB.server.calls).toEqual(["PUT like /a/b#1", "PUT repost /c/d#2"]);
    expect(tabA.sync.hasUnsent).toBe(false);
    tabA.server.api.setReaction.mockClear();
    await tabA.sync.flush();
    expect(tabA.server.api.setReaction).not.toHaveBeenCalled();
  });
});
