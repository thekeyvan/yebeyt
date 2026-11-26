import { describe, expect, it } from "vitest";
import { BlockedPeople } from "../lib/friends/blockedPeople";
import { FeedModel, shown, type FeedEntry } from "../lib/friends/feed";
import { FriendsListModel } from "../lib/friends/friendsList";
import type { FoundPerson } from "../lib/friends/models";
import { fakeServer, ok, person } from "./friends";

// The ports of FriendsFixTests.swift: what comes of blocking, and the feed's counts and pages.

const found = (username: string, friendship: FoundPerson["friendship"]): FoundPerson => ({ ...person(username), friendship, isFriend: friendship === "friends", canPlay: true });
const entry = (username: string): FeedEntry => ({ id: username, item: { type: "like", user: person(username), key: "/a/b#0", at: "2026-11-24T08:00:00.000Z" } });

describe("whom I blocked (BlockedPeople)", () => {
  it("a blocked person leaves every loaded list at once", () => {
    const blocked = new BlockedPeople({ user: { id: "u1" } as never });
    const people = [found("a", "none"), found("b", "friends")];
    expect(blocked.visible(people, (one) => one.username)).toHaveLength(2);
    blocked.add("a");
    expect(blocked.visible(people, (one) => one.username).map((one) => one.username)).toEqual(["b"]);
    expect(blocked.visible([entry("a"), entry("b")], (one) => one.item.user.username).map((one) => one.id)).toEqual(["b"]);
  });

  it("blocks belong to the account that made them and go with the sign-out", () => {
    const session: { user?: { id: string } } = { user: { id: "u1" } };
    const blocked = new BlockedPeople(session as never);
    blocked.add("a");
    expect([...blocked.usernames]).toEqual(["a"]);
    session.user = { id: "u2" };
    expect(blocked.usernames.size).toBe(0); // another account sees none of them
    session.user = undefined;
    blocked.add("b"); // nobody is signed in: nothing is kept
    expect(blocked.usernames.size).toBe(0);
    session.user = { id: "u1" };
    expect([...blocked.usernames]).toEqual(["a"]);
  });

  it("tells whoever listens when someone is blocked", () => {
    const blocked = new BlockedPeople({ user: { id: "u1" } as never });
    let heard = 0;
    blocked.subscribe(() => heard++);
    blocked.add("a");
    expect(heard).toBe(1);
  });
});

describe("the feed (FeedModel)", () => {
  const item = (user: string, n: number, extra: object = {}) => ({ type: "daily", user: person(user), date: "2026-11-24", tries: 1, at: `2026-11-24T08:00:0${n}.000Z`, ...extra });
  const users = (feed: FeedModel, blocked: BlockedPeople) => blocked.visible(feed.snapshot().entries, (one) => one.item.user.username).map((one) => one.item.user.username);

  it("a page's counts come in one call, with every key once", async () => {
    const likes = (key: string) => ({ type: "like", user: person("k"), key, at: "2026-11-24T08:00:01.000Z" });
    const server = fakeServer(({ path }) =>
      path === "/v1/reactions/counts"
        ? ok({ "/a/b#0": { likes: 4, reposts: 2, likedByMe: true, repostedByMe: false }, "/a/b#1": { likes: 0, reposts: 0, likedByMe: false, repostedByMe: false } })
        : ok({ items: [likes("/a/b#0"), { ...likes("/a/b#1"), at: "2026-11-24T08:00:02.000Z" }, { ...likes("/a/b#0"), at: "2026-11-24T08:00:03.000Z" }], nextCursor: null }),
    );
    const feed = new FeedModel({ isSignedIn: true }, server.api);
    await feed.refresh();
    expect(server.to("/v1/reactions/counts")).toHaveLength(1);
    expect(server.to("/v1/reactions/counts")[0]!.query).toBe("keys=/a/b#0,/a/b#1");
    expect([feed.snapshot().counts["/a/b#0"]?.likes, feed.snapshot().counts["/a/b#1"]?.reposts]).toEqual([4, 0]);
  });

  it("splits more than 50 keys into several calls", async () => {
    const many = Array.from({ length: 120 }, (_, n) => ({ type: "like", user: person("k"), key: `/a/b#${n}`, at: `2026-11-24T08:00:${String(n % 60).padStart(2, "0")}.000Z` }));
    const server = fakeServer(({ path }) => (path === "/v1/reactions/counts" ? ok({}) : ok({ items: many, nextCursor: null })));
    await new FeedModel({ isSignedIn: true }, server.api).refresh();
    expect(server.to("/v1/reactions/counts").map((call) => call.query.split(",").length)).toEqual([50, 50, 20]);
  });

  it("my own like changes the shown count without asking again", () => {
    expect(shown(4, false, true)).toBe(5);
    expect(shown(4, true, true)).toBe(4);
    expect(shown(4, true, false)).toBe(3);
    expect(shown(0, true, false)).toBe(0);
  });

  it("keeps asking when a whole page is blocked", async () => {
    const [first, second, third] = [[item("ok", 1)], [item("bad", 2), item("bad", 3)], [item("ok2", 4)]];
    const server = fakeServer(({ query }) => ok(query.includes("cursor=p2") ? { items: second, nextCursor: "p3" } : query.includes("cursor=p3") ? { items: third, nextCursor: null } : { items: first, nextCursor: "p2" }));
    const blocked = new BlockedPeople({ user: { id: "u1" } as never });
    blocked.add("bad");
    const feed = new FeedModel({ isSignedIn: true }, server.api);
    await feed.refresh();
    await feed.loadMore(blocked);
    expect(users(feed, blocked)).toEqual(["ok", "ok2"]);
    expect(feed.hasMore).toBe(false);
  });

  it("a guest has no feed, and a failed refresh keeps what is shown", async () => {
    const server = fakeServer(() => ok({ items: [item("ok", 1)], nextCursor: null }));
    const guest = new FeedModel({ isSignedIn: false }, server.api);
    await guest.refresh();
    expect(server.requests).toHaveLength(0);
    const feed = new FeedModel({ isSignedIn: true }, server.api);
    await feed.refresh();
    server.respond(() => "offline");
    await feed.refresh();
    expect(feed.snapshot().entries).toHaveLength(1);
  });

  it("one page at a time: a page being read is not asked for twice, and an entry seen twice is kept once", async () => {
    const server = fakeServer(({ query }) => ok(query.includes("cursor") ? { items: [item("a", 1), item("b", 2)], nextCursor: null } : { items: [item("a", 1)], nextCursor: "2" }));
    const blocked = new BlockedPeople({ user: { id: "u1" } as never });
    const feed = new FeedModel({ isSignedIn: true }, server.api);
    await feed.refresh();
    await Promise.all([feed.loadMore(blocked), feed.loadMore(blocked)]);
    expect(feed.snapshot().entries.map((one) => one.item.user.username)).toEqual(["a", "b"]);
    expect(server.requests.filter((call) => call.path === "/v1/feed")).toHaveLength(2);
  });
});

describe("my friends list (FriendsListModel)", () => {
  it("keeps asking when a whole page is blocked", async () => {
    const pages: Record<string, unknown> = {
      first: { items: [person("a")], nextCursor: "p2" },
      p2: { items: [person("bad")], nextCursor: "p3" },
      p3: { items: [person("c")], nextCursor: null },
    };
    const server = fakeServer(({ query }) => ok(pages[query.replace("cursor=", "") || "first"]));
    const blocked = new BlockedPeople({ user: { id: "u1" } as never });
    blocked.add("bad");
    const friends = new FriendsListModel(server.api);
    await friends.load();
    await friends.loadMore(blocked);
    expect(blocked.visible(friends.snapshot().people, (one) => one.username).map((one) => one.username)).toEqual(["a", "c"]);
    expect(friends.hasMore).toBe(false);
  });

  it("a failed first page is a failure, a failed later page keeps the list, and a reload replaces it", async () => {
    const server = fakeServer(() => "offline");
    const friends = new FriendsListModel(server.api);
    await friends.load();
    expect(friends.snapshot().phase.kind).toBe("failed");
    server.respond(() => ok({ items: [person("a")], nextCursor: "2" }));
    await friends.load();
    server.respond(() => "offline");
    await friends.loadMore(new BlockedPeople({ user: undefined }));
    expect(friends.snapshot().people).toHaveLength(1);
    expect(friends.hasMore).toBe(true);
    server.respond(() => ok({ items: [person("z"), person("a")], nextCursor: null }));
    await friends.reload();
    expect(friends.snapshot().people.map((one) => one.username)).toEqual(["z", "a"]);
    expect(friends.hasMore).toBe(false);
  });
});
