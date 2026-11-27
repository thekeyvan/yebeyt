import { describe, expect, it } from "vitest";
import { SharedDivanModel } from "../lib/messages/sharedDivan";
import { SharedDivanAdder } from "../lib/messages/sharedDivanAdder";
import type { SharedDivanItem } from "../lib/messages/models";
import { fakeServer, none, ok, refuse, type Answer, type Seen } from "./friends";
import { item, tick } from "./messages";

// The ports of SharedDivanTests.swift.

const sarahDivan = { id: "d1", other: { username: "sara", displayName: "سارا", avatar: null }, counts: { total: 24, mine: 11, theirs: 13 } };
const divans = { items: [sarahDivan], nextCursor: null };
const items = (list: SharedDivanItem[], counts = { total: 24, mine: 11, theirs: 13 }, next: string | null = null) => ({ items: list, nextCursor: next, counts });

const hafez = item("i1", "/hafez/ghazal/sh3#0", false, { note: "یاد سفر شیراز افتادم", likedByMe: true, createdAt: "2026-11-23T09:00:00Z" });
const saadi = item("i2", "/saadi/golestan/sh1#2", true, { likedByThem: true, createdAt: "2026-11-21T09:00:00Z" });
const molana = item("i3", "/moulavi/masnavi/daftar1/sh1#0", false, { createdAt: "2026-11-15T09:00:00Z" });
const hafez2 = item("i4", "/hafez/ghazal/sh9#1", true, { createdAt: "2026-11-14T09:00:00Z" });

/** The server of a divan: `by=me` and `by=them` filter, the counts always cover the whole divan. */
function server(request: Seen): Answer {
  if (request.method === "GET" && request.path === "/v1/shared-divans") return ok(divans);
  if (request.method === "GET" && request.path === "/v1/shared-divans/d1/items") {
    if (request.query.includes("by=me")) return ok(items([saadi, hafez2]));
    if (request.query.includes("by=them")) return ok(items([hafez, molana]));
    return ok(items([hafez, saadi, molana, hafez2]));
  }
  return refuse(404, "not_found");
}

function make(handler: (request: Seen) => Answer | Promise<Answer> = server) {
  const s = fakeServer(handler);
  return { ...s, model: new SharedDivanModel("sara", s.api) };
}

const ids = (model: SharedDivanModel) => model.snapshot().items.map((one) => one.id);
const counts = (total: number, mine: number, theirs: number) => ({ total, mine, theirs });
const itemRequests = (requests: Seen[]) => requests.filter((request) => request.path.endsWith("/items"));

describe("the shared divan", () => {
  it("the divan with the person is found and its couplets load", async () => {
    const { model, requests } = make();
    await model.load();
    expect(model.snapshot().phase.kind).toBe("loaded");
    expect(model.snapshot().divan?.id).toBe("d1");
    expect(ids(model)).toEqual(["i1", "i2", "i3", "i4"]);
    expect(model.snapshot().counts).toEqual(counts(24, 11, 13));
    expect(model.subtitle("سارا")).toBe("۲۴ بیت · سارا ۱۳، تو ۱۱");
    expect(requests.some((request) => request.method === "POST")).toBe(false);
  });

  it("a divan that does not exist yet is made, and a non-friend is told", async () => {
    const { model, requests } = make((request) => {
      if (request.path === "/v1/shared-divans") return request.method === "POST" ? ok({ ...sarahDivan, counts: counts(0, 0, 0) }) : ok({ items: [], nextCursor: null });
      return ok(items([], counts(0, 0, 0)));
    });
    await model.load();
    expect(model.snapshot().phase.kind).toBe("loaded");
    expect(ids(model)).toEqual([]);
    expect(requests.some((request) => request.method === "POST" && request.path === "/v1/shared-divans")).toBe(true);
    const refused = make((request) => (request.method === "POST" ? refuse(403, "forbidden") : ok({ items: [], nextCursor: null })));
    await refused.model.load();
    expect(refused.model.snapshot().phase).toEqual({ kind: "failed", message: "فقط با دوستات می‌شه دیوان مشترک داشت" });
  });

  it("the chips filter by who added and by poet, and a poet needs no new request", async () => {
    const { model, requests } = make();
    await model.load();
    expect(model.snapshot().poetSlugs).toEqual(["hafez", "saadi", "moulavi"]); // two of Hafez's, then in the order they come
    await model.select("them");
    expect(ids(model)).toEqual(["i1", "i3"]);
    expect(model.snapshot().counts).toEqual(counts(24, 11, 13)); // the counts cover the whole divan
    expect(requests.at(-1)!.query).toContain("by=them");
    await model.select("me");
    expect(ids(model)).toEqual(["i2", "i4"]);
    await model.select("poet:hafez"); // a poet is chosen among everyone's couplets
    expect(model.snapshot().items).toHaveLength(4);
    expect(model.visibleItems.map((one) => one.id)).toEqual(["i1", "i4"]);
    const before = requests.length;
    await model.select("poet:saadi"); // no new request between poets
    expect(requests).toHaveLength(before);
    expect(model.visibleItems.map((one) => one.id)).toEqual(["i2"]);
    await model.select("all");
    expect(model.visibleItems).toHaveLength(4);
    expect(model.snapshot().poetSlugs).toEqual(["hafez", "saadi", "moulavi"]);
  });

  it("more pages are added at the end", async () => {
    const { model } = make((request) => {
      if (request.path === "/v1/shared-divans") return ok(divans);
      return request.query.includes("cursor=p2") ? ok(items([molana])) : ok(items([hafez, saadi], undefined, "p2"));
    });
    await model.load();
    expect(model.snapshot().hasMore).toBe(true);
    await model.loadMore();
    expect(ids(model)).toEqual(["i1", "i2", "i3"]);
    expect(model.snapshot().hasMore).toBe(false);
  });
});

describe("likes", () => {
  it("liking is at once and the server's answer stands", async () => {
    const { model, requests } = make((request) => {
      if (request.path.endsWith("/i2/like")) return ok({ ...saadi, likedByMe: request.method === "PUT" });
      return server(request);
    });
    await model.load();
    await model.toggleLike(model.snapshot().items[1]!);
    expect(model.snapshot().items[1]).toMatchObject({ likedByMe: true, likedByThem: true });
    await model.toggleLike(model.snapshot().items[1]!);
    expect(model.snapshot().items[1]!.likedByMe).toBe(false);
    expect(requests.filter((request) => request.path.endsWith("/like")).map((request) => request.method)).toEqual(["PUT", "DELETE"]);
  });

  it("a like that fails is taken back", async () => {
    const { model } = make((request) => (request.path.endsWith("/like") ? "offline" : server(request)));
    await model.load();
    await model.toggleLike(model.snapshot().items[0]!); // i1 was liked by me
    expect(model.snapshot().items[0]!.likedByMe).toBe(true);
    expect(model.snapshot().toast?.line).toBe("اینترنت نیست؛ یه بار دیگه امتحان کن.");
  });
});

describe("removing", () => {
  it("a couplet I added is taken out at once and the server is asked", async () => {
    const { model, requests } = make((request) => (request.method === "DELETE" ? none() : server(request)));
    await model.load();
    const done = model.remove(model.snapshot().items[1]!); // i2 is mine
    expect(ids(model)).toEqual(["i1", "i3", "i4"]); // already out, before the server answers
    expect(model.snapshot().counts).toEqual(counts(23, 10, 13));
    await done;
    expect(ids(model)).toEqual(["i1", "i3", "i4"]);
    expect(model.snapshot().toast).toBeUndefined();
    expect(requests.filter((request) => request.method === "DELETE").map((request) => request.path)).toEqual(["/v1/shared-divans/d1/items/i2"]);
  });

  it("a removal that fails puts the couplet back where it was and shows the toast", async () => {
    const { model } = make((request) => (request.method === "DELETE" ? "offline" : server(request)));
    await model.load();
    await model.remove(model.snapshot().items[1]!);
    expect(ids(model)).toEqual(["i1", "i2", "i3", "i4"]);
    expect(model.snapshot().counts).toEqual(counts(24, 11, 13));
    expect(model.snapshot().toast?.line).toBe("اینترنت نیست؛ یه بار دیگه امتحان کن.");
  });

  it("a failed removal goes back by its date even when the list changed meanwhile", async () => {
    let failed = false;
    const { model } = make((request) => {
      if (request.method === "DELETE") {
        failed = true;
        return "offline";
      }
      return failed ? "offline" : server(request); // and the list can't be read again
    });
    await model.load();
    const done = model.remove(model.snapshot().items[1]!); // i2
    model.apply({ type: "divan", sharedDivanId: "d1", item: item("i9", "/hafez/ghazal/sh4#0", false, { createdAt: "2026-11-25T09:00:00Z" }) }); // arrives at the top meanwhile
    await done;
    expect(ids(model)).toEqual(["i9", "i1", "i2", "i3", "i4"]);
    expect(model.snapshot().counts).toEqual(counts(25, 11, 14));
  });

  it("a failed removal reads the counts from the server", async () => {
    let failed = false;
    const { model } = make((request) => {
      if (request.method === "DELETE") {
        failed = true;
        return refuse(500, "unavailable");
      }
      return failed && request.path.endsWith("/items") ? ok(items([hafez, saadi, molana, hafez2], counts(30, 15, 15))) : server(request);
    });
    await model.load();
    await model.remove(model.snapshot().items[1]!);
    expect(ids(model)).toEqual(["i1", "i2", "i3", "i4"]);
    expect(model.snapshot().counts).toEqual(counts(30, 15, 15));
    expect(model.snapshot().toast).toBeDefined();
  });

  it("a removal the server answers 404 to stays removed without a toast, and any other refusal puts it back", async () => {
    const { model } = make((request) => (request.method === "DELETE" ? refuse(404, "not_found") : server(request)));
    await model.load();
    await model.remove(model.snapshot().items[1]!); // it is already gone from the server
    expect(ids(model)).toEqual(["i1", "i3", "i4"]);
    expect(model.snapshot().counts).toEqual(counts(23, 10, 13));
    expect(model.snapshot().toast).toBeUndefined();
    const refused = make((request) => (request.method === "DELETE" ? refuse(403, "forbidden") : server(request)));
    await refused.model.load();
    await refused.model.remove(refused.model.snapshot().items[1]!);
    expect(ids(refused.model)).toEqual(["i1", "i2", "i3", "i4"]);
    expect(refused.model.snapshot().toast).toBeDefined();
  });

  it("only a couplet I added can be removed", async () => {
    const { model, requests } = make();
    await model.load();
    await model.remove(model.snapshot().items[0]!); // i1 is hers
    expect(ids(model)).toEqual(["i1", "i2", "i3", "i4"]);
    expect(requests.some((request) => request.method === "DELETE")).toBe(false);
  });

  it("a removed couplet leaves the poet chips that no longer have one", async () => {
    const { model } = make((request) => (request.method === "DELETE" ? none() : server(request)));
    await model.load();
    expect(model.snapshot().poetSlugs).toEqual(["hafez", "saadi", "moulavi"]);
    await model.remove(model.snapshot().items[1]!); // the only couplet of Saadi
    expect(model.snapshot().poetSlugs).toEqual(["hafez", "moulavi"]);
  });
});

describe("live", () => {
  it("a couplet the other person adds comes in at the top and moves the counts, once, and only for this divan", async () => {
    const { model } = make();
    await model.load();
    const added = item("i9", "/hafez/ghazal/sh4#0", false);
    model.apply({ type: "divan", sharedDivanId: "d1", item: added });
    expect(model.snapshot().items[0]!.id).toBe("i9");
    expect(model.snapshot().counts).toEqual(counts(25, 11, 14));
    model.apply({ type: "divan", sharedDivanId: "d1", item: added }); // the same event twice
    expect(model.snapshot().items).toHaveLength(5);
    expect(model.snapshot().counts?.total).toBe(25);
    model.apply({ type: "divan", sharedDivanId: "other", item: added });
    expect(model.snapshot().items).toHaveLength(5);
    // With «از من» on, their couplet only moves the counts.
    await model.select("me");
    model.apply({ type: "divan", sharedDivanId: "d1", item: item("i10", "/hafez/ghazal/sh5#0", false) });
    expect(ids(model)).toEqual(["i2", "i4"]);
    expect(model.snapshot().counts).toEqual(counts(25, 11, 14)); // the list read again (24), plus this one
  });

  it("a couplet removed live leaves the list and moves the counts, once", async () => {
    const { model, requests } = make();
    await model.load();
    model.apply({ type: "divan.removed", sharedDivanId: "other", itemId: "i1" });
    expect(model.snapshot().items).toHaveLength(4);
    model.apply({ type: "divan.removed", sharedDivanId: "d1", itemId: "i1" }); // hers
    expect(ids(model)).toEqual(["i2", "i3", "i4"]);
    expect(model.snapshot().counts).toEqual(counts(23, 11, 12));
    model.apply({ type: "divan.removed", sharedDivanId: "d1", itemId: "i1" }); // the same event twice
    expect(model.snapshot().counts).toEqual(counts(23, 11, 12));
    expect(itemRequests(requests)).toHaveLength(1); // nothing read again
  });

  it("the live event of my own removal counts nothing twice", async () => {
    const { model } = make((request) => (request.method === "DELETE" ? none() : server(request)));
    await model.load();
    await model.remove(model.snapshot().items[1]!);
    model.apply({ type: "divan.removed", sharedDivanId: "d1", itemId: "i2" });
    expect(model.snapshot().counts).toEqual(counts(23, 10, 13));
    expect(ids(model)).toEqual(["i1", "i3", "i4"]);
  });

  it("a couplet removed live that the list does not hold reads the list again when the screen shows, and nothing when it is away", async () => {
    let reads = 0;
    const { model, requests } = make((request) => {
      if (request.method === "GET" && request.path.endsWith("/items") && request.query.includes("by=me")) {
        reads += 1; // the first read is before her removal, the next ones after it
        return ok(reads === 1 ? items([saadi, hafez2]) : items([saadi, hafez2], counts(23, 11, 12)));
      }
      return server(request);
    });
    await model.load();
    await model.select("me"); // «از من»: her couplets are not in the list, but the counts move
    const before = itemRequests(requests).length;
    model.isVisible = true;
    model.apply({ type: "divan.removed", sharedDivanId: "d1", itemId: "i1" });
    await tick(20);
    expect(model.snapshot().counts).toEqual(counts(23, 11, 12));
    expect(itemRequests(requests)).toHaveLength(before + 1);
    // Away, nothing is read.
    const away = make();
    await away.model.load();
    await away.model.select("me");
    const reading = itemRequests(away.requests).length;
    away.model.isVisible = false;
    away.model.apply({ type: "divan.removed", sharedDivanId: "d1", itemId: "i1" });
    await tick(30);
    expect(itemRequests(away.requests)).toHaveLength(reading);
  });
});

describe("adding", () => {
  it("adding from the divan reads the list and the counts again, and the live event of my own add counts nothing twice", async () => {
    let posted = false;
    const mine = item("i9", "/hafez/ghazal/sh3#0", true, { note: "یاد تو" });
    const { model, requests } = make((request) => {
      if (request.method === "POST" && request.path === "/v1/shared-divans/d1/items") {
        posted = true;
        return { status: 201, body: mine };
      }
      if (posted && request.method === "GET" && request.path === "/v1/shared-divans/d1/items") return ok(items([mine, hafez], counts(25, 12, 13)));
      return server(request);
    });
    await model.load();
    await model.add("/hafez/ghazal/sh3#0", " یاد تو ");
    expect(model.snapshot().items[0]!.id).toBe("i9");
    expect(model.snapshot().counts).toEqual(counts(25, 12, 13));
    expect(requests.find((request) => request.method === "POST")!.json).toEqual({ key: "/hafez/ghazal/sh3#0", note: "یاد تو" });
    model.apply({ type: "divan", sharedDivanId: "d1", item: item("i9", "/hafez/ghazal/sh3#0", true) });
    expect(model.snapshot().counts).toEqual(counts(25, 12, 13));
    expect(model.snapshot().items.filter((one) => one.id === "i9")).toHaveLength(1);
  });

  it("a couplet already there is not counted again", async () => {
    const { model } = make((request) => (request.method === "POST" ? ok(item("i1", "/hafez/ghazal/sh3#0", false)) : server(request)));
    await model.load();
    await model.add("/hafez/ghazal/sh3#0");
    expect(model.snapshot().counts).toEqual(counts(24, 11, 13));
    expect(model.snapshot().items).toHaveLength(4);
  });

  it("a refused add says why", async () => {
    const { model } = make((request) => (request.method === "POST" ? refuse(403, "forbidden") : server(request)));
    await model.load();
    await model.add("/hafez/ghazal/sh4#0");
    expect(model.snapshot().toast?.line).toBe("فقط با دوستات می‌شه دیوان مشترک داشت");
    expect(model.snapshot().items).toHaveLength(4);
  });

  it("a note is cut at two hundred UTF-16 units", async () => {
    const { model, requests } = make((request) => (request.method === "POST" ? { status: 201, body: item("i9", "/hafez/ghazal/sh3#0", true) } : server(request)));
    await model.load();
    await model.add("/hafez/ghazal/sh3#0", "😀".repeat(150));
    expect((requests.find((request) => request.method === "POST")!.json!.note as string).length).toBe(200);
  });
});

describe("«به دیوان مشترک» in the hold menu", () => {
  const friends = { items: [{ username: "sara", displayName: "سارا", avatar: null }, { username: "kian", displayName: "کیان", avatar: null }, { username: "mahsa", displayName: null, avatar: null }], nextCursor: null };
  const adderOf = (handler: (request: Seen) => Answer | Promise<Answer>, person?: { username: string; displayName: string | null; avatar: null }) => {
    const s = fakeServer(handler);
    return { ...s, adder: new SharedDivanAdder({ key: "/hafez/ghazal/sh3#0", person }, s.api) };
  };

  it("lists the friends with a divan first and then the other friends", async () => {
    const { adder } = adderOf((request) => (request.path === "/v1/shared-divans" ? ok(divans) : request.path === "/v1/me/friends" ? ok(friends) : refuse(404, "not_found")));
    await adder.load();
    expect(adder.snapshot().divans.map((divan) => divan.other.username)).toEqual(["sara"]);
    expect(adder.snapshot().showsFriends).toBe(false);
    await adder.showFriends();
    expect(adder.snapshot().friends.map((friend) => friend.username)).toEqual(["kian", "mahsa"]); // Sara already has a divan, listed above
  });

  it("adds to an existing divan, with the note, and says where", async () => {
    const { adder, requests } = adderOf((request) => (request.path === "/v1/shared-divans" ? ok(divans) : request.method === "POST" ? { status: 201, body: item("i1", "/hafez/ghazal/sh3#0", true) } : refuse(404, "not_found")));
    await adder.load();
    adder.choose(adder.snapshot().divans[0]!.other);
    adder.setNote("  یاد تو افتادم  ");
    expect(await adder.add()).toBe(true);
    expect(adder.snapshot().phase).toEqual({ done: "به دیوان من و سارا اضافه شد" });
    const post = requests.find((request) => request.method === "POST")!;
    expect(post.path).toBe("/v1/shared-divans/d1/items");
    expect(post.json).toEqual({ key: "/hafez/ghazal/sh3#0", note: "یاد تو افتادم" });
    expect(requests.some((request) => request.method === "POST" && request.path === "/v1/shared-divans")).toBe(false);
  });

  it("makes a divan for a friend who has none, from a chat nobody is listed, and leaves the note out when there is none", async () => {
    const kian = { username: "kian", displayName: "کیان", avatar: null };
    const { adder, requests } = adderOf(
      (request) => (request.path === "/v1/shared-divans" ? ok({ id: "d2", other: kian, counts: counts(0, 0, 0) }) : { status: 201, body: item("i1", "/hafez/ghazal/sh3#0", true) }),
      kian,
    );
    await adder.load(); // from a chat nobody needs to be listed
    expect(requests).toEqual([]);
    expect(await adder.add()).toBe(true);
    expect(adder.snapshot().phase).toEqual({ done: "به دیوان من و کیان اضافه شد" });
    expect(requests.map((request) => request.path)).toEqual(["/v1/shared-divans", "/v1/shared-divans/d2/items"]);
    expect(requests[1]!.json).toEqual({ key: "/hafez/ghazal/sh3#0" });
  });

  it("a non-friend is told with the lead's line and can try again", async () => {
    const stranger = { username: "stranger", displayName: null, avatar: null };
    const { adder, respond } = adderOf(() => refuse(403, "forbidden"), stranger);
    expect(await adder.add()).toBe(false);
    expect(adder.snapshot().failure).toBe("فقط با دوستات می‌شه دیوان مشترک داشت");
    expect(adder.snapshot().phase).toBe("choosing");
    respond((request) => (request.path === "/v1/shared-divans" ? ok({ id: "d3", other: stranger, counts: counts(0, 0, 0) }) : { status: 201, body: item("i1", "/hafez/ghazal/sh3#0", true) }));
    expect(await adder.add()).toBe(true);
    expect(adder.snapshot().failure).toBeUndefined();
  });

  it("the sheet's note is cut at two hundred UTF-16 units, and nothing is added until someone is chosen", async () => {
    const { adder, requests } = adderOf(() => refuse(404, "not_found"));
    expect(await adder.add()).toBe(false);
    expect(requests).toEqual([]);
    adder.setNote("😀".repeat(150));
    expect(adder.snapshot().note.length).toBe(200);
  });
});
