import { describe, expect, it } from "vitest";
import { ApiError } from "../lib/account/api";
import { FriendsCenter } from "../lib/friends/center";
import { asksFirst, buttonsOf, confirmationFor, confirmUnfriend, friendCopy, friendToast, isMain, requires, resultOf, titleOf, type FriendAction } from "../lib/friends/friendship";
import { FriendsListModel } from "../lib/friends/friendsList";
import { PeopleSearchModel } from "../lib/friends/search";
import { PersonModel } from "../lib/friends/person";
import { FriendRequestsModel } from "../lib/friends/requests";
import { fakeServer, gate, none, ok, person, refuse } from "./friends";
import { settle } from "./account";

// The ports of FriendRequestTests.swift: friend requests replace follows: the states of a person, what each shows, and the calls that change them.

describe("the states of a friendship (FriendshipStateTests)", () => {
  it("each state offers its buttons and its words", () => {
    expect(buttonsOf("none")).toEqual(["send"]);
    expect(buttonsOf("requested")).toEqual(["cancel"]);
    expect(buttonsOf("incoming")).toEqual(["accept", "reject"]);
    expect(buttonsOf("friends")).toEqual([]); // «دوستین» is a chip, not a button
    expect(buttonsOf("none").map(titleOf)).toEqual(["درخواست دوستی"]);
    expect(buttonsOf("requested").map(titleOf)).toEqual(["درخواست فرستادی"]);
    expect(buttonsOf("incoming").map(titleOf)).toEqual(["قبول", "رد"]);
    expect(friendCopy.friends).toBe("دوستین");
    expect(titleOf("unfriend")).toBe("حذف از دوستا");
    expect(friendCopy.cancelSent).toBe("لغو");
    expect([friendCopy.requestsTitle, friendCopy.sentSection]).toEqual(["درخواست‌های دوستی", "فرستادی"]);
    expect(confirmUnfriend("سارا")).toBe("سارا از دوستات حذف بشه؟");
    expect(friendCopy.confirmUnfriendButton).toBe("حذف کن");
  });

  it("only asking and accepting are painted as the main button", () => {
    expect(isMain("send") && isMain("accept")).toBe(true);
    expect([isMain("cancel"), isMain("reject"), isMain("unfriend")]).toEqual([false, false, false]); // «درخواست فرستادی» is grey
  });

  it("each action moves one state to another", () => {
    const moves: [FriendAction, string, string][] = [["send", "none", "requested"], ["cancel", "requested", "none"], ["accept", "incoming", "friends"], ["reject", "incoming", "none"], ["unfriend", "friends", "none"]];
    for (const [action, from, to] of moves) expect([requires(action), resultOf(action)]).toEqual([from, to]);
  });

  it("taking a request back and rejecting one ask first, with the owner's words; nothing else does", () => {
    expect(["send", "cancel", "accept", "reject", "unfriend"].filter((action) => asksFirst(action as FriendAction))).toEqual(["cancel", "reject"]);
    expect(confirmationFor("cancel")).toEqual({ title: "درخواستت رو پس بگیری؟", confirm: "پس بگیر" });
    expect(confirmationFor("reject")).toEqual({ title: "درخواستش رو رد کنی؟", message: "بهش خبر نمی‌دیم.", confirm: "رد کن" });
    expect(["send", "accept", "unfriend"].map((action) => confirmationFor(action as FriendAction))).toEqual([undefined, undefined, undefined]);
    expect(friendCopy.keep).toBe("نه");
  });

  it("a too-many-requests answer asks to wait, and other failures keep their words", () => {
    expect(friendToast(new ApiError(429, "rate_limited"))).toBe("یه کم بعد دوباره امتحان کن");
    expect(friendToast(new ApiError(429))).toBe("یه کم بعد دوباره امتحان کن");
    expect(friendToast(new ApiError(0))).toBe(new ApiError(0).persianMessage);
  });
});

describe("the calls of friends (FriendsAPITests)", () => {
  it("every action calls its endpoint and answers the new state", async () => {
    const server = fakeServer((request) => (request.path.startsWith("/v1/friend-requests/sara") && request.method === "POST" && !request.path.endsWith("reject") ? ok({ friendship: "friends" }) : none()));
    expect(await server.api.friendAction("send", "sara")).toBe("friends"); // they had asked me: it accepted
    expect(await server.api.friendAction("accept", "sara")).toBe("friends");
    expect(await server.api.friendAction("cancel", "sara")).toBe("none");
    expect(await server.api.friendAction("reject", "sara")).toBe("none");
    expect(await server.api.friendAction("unfriend", "sara")).toBe("none");
    expect(server.requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      "POST /v1/friend-requests/sara", "POST /v1/friend-requests/sara/accept", "DELETE /v1/friend-requests/sara", "POST /v1/friend-requests/sara/reject", "DELETE /v1/friends/sara",
    ]);
  });

  it("requests are asked by direction and decoded", async () => {
    const server = fakeServer(() => ok({ items: [{ ...person("sara", "سارا"), createdAt: "2026-11-24T09:00:00.000Z" }], nextCursor: "2" }));
    const page = await server.api.friendRequests("incoming", "1");
    expect(page.items.map((item) => item.username)).toEqual(["sara"]);
    expect(page.nextCursor).toBe("2");
    expect(server.requests[0]).toMatchObject({ path: "/v1/me/friend-requests", query: "direction=incoming&cursor=1" });
    await server.api.friendRequests("outgoing");
    expect(server.requests[1]!.query).toBe("direction=outgoing");
  });

  it("the unread answer carries the request count, and a search result and a profile the friendship state", async () => {
    const server = fakeServer((request) => (request.path === "/v1/me/unread" ? ok({ total: 3, friendRequests: 2 }) : request.path === "/v1/users/search" ? ok({ items: [{ ...person("sara"), friendship: "incoming", isFriend: false, canPlay: true }] }) : ok({ ...person("sara", "سارا"), friendsCount: 3, friendship: "friends", isFriend: true, canMessage: true, league: null, weekPoints: null })));
    expect(await server.api.unread()).toEqual({ total: 3, friendRequests: 2 });
    expect((await server.api.searchUsers("sa"))[0]!.friendship).toBe("incoming");
    expect(server.requests[1]!.query).toBe("q=sa");
    expect(await server.api.profile("sara")).toMatchObject({ friendship: "friends", isFriend: true, canMessage: true });
  });

  it("blocking and reporting call their endpoints", async () => {
    const server = fakeServer(() => none());
    await server.api.block("bardia");
    await server.api.report({ username: "bardia", reason: "spam", note: "x" });
    expect(server.requests.map(({ method, path, json }) => [method, path, json])).toEqual([["PUT", "/v1/blocks/bardia", undefined], ["POST", "/v1/reports", { username: "bardia", reason: "spam", note: "x" }]]);
  });
});

// MARK: Another person's page

const profile = (friendship: string, canMessage = false) => ({ ...person("sara", "سارا"), friendsCount: 12, friendship, isFriend: friendship === "friends", canMessage, league: { tier: 2 }, weekPoints: 300 });

describe("another person's page (PersonFriendshipTests)", () => {
  /** A page that starts as `start`; once something was changed on the server (a write) the profile reads as `then`. */
  async function page(start: string, then: string | undefined, answers: (path: string, method: string) => ReturnType<typeof ok> | ReturnType<typeof none> | ReturnType<typeof refuse>) {
    let written = false;
    const server = fakeServer(({ method, path }) => {
      if (method === "GET") return ok(written ? profile(then ?? start, then === "friends") : profile(start));
      written = true;
      return answers(path, method);
    });
    const notes: string[] = [];
    const model = new PersonModel("sara", server.api, (text) => notes.push(text));
    await model.load();
    return { model, server, notes };
  }

  it("sending a request shows «requested» at once and keeps the server's answer", async () => {
    const wait = gate();
    const server = fakeServer(async ({ method }) => {
      if (method === "GET") return ok(profile("none"));
      await wait.opened;
      return ok({ friendship: "requested" });
    });
    const model = new PersonModel("sara", server.api);
    await model.load();
    expect(model.friendship).toBe("none");
    const done = model.perform("send");
    expect(model.friendship).toBe("requested"); // before the server answered
    expect(model.snapshot().isBusy).toBe(true);
    wait.open();
    await done;
    expect(model.snapshot().isBusy).toBe(false);
    expect(server.requests.filter((request) => request.path.startsWith("/v1/friend")).map((request) => request.path)).toEqual(["/v1/friend-requests/sara"]);
  });

  it("cancelling, accepting, rejecting and removing each land on their state", async () => {
    const cases: [FriendAction, string, string][] = [["cancel", "requested", "none"], ["accept", "incoming", "friends"], ["reject", "incoming", "none"], ["unfriend", "friends", "none"]];
    for (const [action, start, end] of cases) {
      const { model } = await page(start, end, (path) => (path.endsWith("/accept") ? ok({ friendship: "friends" }) : none()));
      await model.perform(action);
      expect(model.friendship, action).toBe(end);
    }
  });

  it("a request they already sent becomes friends whatever we asked for", async () => {
    const { model } = await page("none", "friends", () => ok({ friendship: "friends" }));
    await model.perform("send");
    expect(model.friendship).toBe("friends");
  });

  it("a refused action goes back with a message", async () => {
    const { model, notes } = await page("incoming", undefined, () => refuse(500, "internal_error"));
    await model.perform("accept");
    expect(model.friendship).toBe("incoming");
    expect(model.snapshot().isBusy).toBe(false);
    expect(notes).toEqual([new ApiError(500, "internal_error").persianMessage]);
  });

  it("too many requests go back and ask to wait", async () => {
    const { model, notes } = await page("none", undefined, () => refuse(429, "rate_limited"));
    await model.perform("send");
    expect(model.friendship).toBe("none");
    expect(notes).toEqual(["یه کم بعد دوباره امتحان کن"]);
  });

  it("an action that does not fit the state does nothing", async () => {
    const { model, server } = await page("friends", undefined, () => none());
    await model.perform("send");
    expect(server.requests.filter((request) => request.path.startsWith("/v1/friend"))).toEqual([]);
    expect(model.friendship).toBe("friends");
  });

  it("becoming friends reads the page again, for the message button", async () => {
    const { model } = await page("incoming", "friends", () => ok({ friendship: "friends" }));
    expect(model.snapshot().profile?.canMessage).toBe(false);
    await model.perform("accept");
    expect(model.friendship).toBe("friends");
    expect(model.snapshot().profile?.canMessage).toBe(true);
  });

  it("a person who is not there is «not found»; a network failure is a failure that keeps the page", async () => {
    const server = fakeServer(() => refuse(404, "not_found"));
    const model = new PersonModel("ghost", server.api);
    await model.load();
    expect(model.snapshot().phase).toEqual({ kind: "notFound" });
    server.respond(() => "offline");
    const other = new PersonModel("sara", server.api);
    await other.load();
    expect(other.snapshot().phase).toEqual({ kind: "failed", message: new ApiError(0).persianMessage });
  });

  it("a report is sent with its reason and a trimmed note of at most 500 characters, and says «گزارشت رسید»", async () => {
    const { model, server, notes } = await page("none", undefined, () => none());
    expect(await model.report("abuse", `  ${"ک".repeat(600)} \n`)).toBe(true);
    const sent = server.to("/v1/reports")[0]!.json!;
    expect(sent).toMatchObject({ username: "sara", reason: "abuse" });
    expect([...String(sent.note)]).toHaveLength(500);
    expect(notes).toEqual(["گزارشت رسید"]);
    await model.report("spam", "   ");
    expect(server.to("/v1/reports")[1]!.json).toEqual({ username: "sara", reason: "spam" }); // no note at all
  });

  it("a refused block or report stays and tells why", async () => {
    const { model, notes } = await page("none", undefined, () => refuse(500, "internal_error"));
    expect(await model.block()).toBe(false);
    expect(await model.report("other", "")).toBe(false);
    expect(notes).toHaveLength(2);
  });
});

// MARK: Search rows

describe("the people search (SearchFriendshipTests)", () => {
  const found = (state: string) => ({ items: [{ ...person("sara", "سارا"), friendship: state, isFriend: state === "friends", canPlay: true }] });

  async function search(state: string, answers: (request: { method: string }) => ReturnType<typeof ok> | ReturnType<typeof none>) {
    const server = fakeServer((request) => (request.method === "GET" ? ok(found(state)) : answers(request)));
    const model = new PeopleSearchModel(server.api, undefined, 1);
    model.queryChanged("sara");
    await model.settle();
    return { model, server };
  }

  it("a row asks, then waits, then cancels", async () => {
    const { model, server } = await search("none", ({ method }) => (method === "POST" ? ok({ friendship: "requested" }) : none()));
    expect(model.snapshot().people[0]!.friendship).toBe("none");
    expect(await model.perform("send", "sara")).toBeUndefined();
    expect(model.snapshot().people[0]).toMatchObject({ friendship: "requested", isFriend: false });
    expect(await model.perform("cancel", "sara")).toBeUndefined(); // no confirmation in the model: the screen asks
    expect(model.snapshot().people[0]!.friendship).toBe("none");
    expect(server.requests.filter((request) => request.path.startsWith("/v1/friend")).map((request) => `${request.method} ${request.path}`)).toEqual(["POST /v1/friend-requests/sara", "DELETE /v1/friend-requests/sara"]);
  });

  it("accepting a row makes them a friend", async () => {
    const { model } = await search("incoming", () => ok({ friendship: "friends" }));
    expect(await model.perform("accept", "sara")).toBeUndefined();
    expect(model.snapshot().people[0]).toMatchObject({ friendship: "friends", isFriend: true });
  });

  it("a refused row goes back and gives the message", async () => {
    const { model } = await search("none", () => refuse(429, "rate_limited") as never);
    expect(await model.perform("send", "sara")).toBe("یه کم بعد دوباره امتحان کن");
    expect(model.snapshot().people[0]!.friendship).toBe("none");
    expect(model.snapshot().pending.size).toBe(0);
  });

  it("a row shows the new state before the server answers, and a second tap waits for the first", async () => {
    const wait = gate();
    const server = fakeServer(async ({ method }) => {
      if (method === "GET") return ok(found("none"));
      await wait.opened;
      return ok({ friendship: "requested" });
    });
    const model = new PeopleSearchModel(server.api, undefined, 1);
    model.queryChanged("sara");
    await model.settle();
    const first = model.perform("send", "sara");
    expect(model.snapshot().people[0]!.friendship).toBe("requested");
    expect(model.snapshot().pending.has("sara")).toBe(true);
    expect(await model.perform("cancel", "sara")).toBeUndefined();
    wait.open();
    await first;
    expect(server.requests.filter((request) => request.method === "DELETE")).toEqual([]);
  });

  it("waits for a pause in typing, needs two characters, drops «@» and capitals, and drops an answer that comes after the text changed", async () => {
    const wait = gate();
    const server = fakeServer(async ({ query }) => {
      if (query === "q=ar") await wait.opened;
      return ok({ items: query === "q=ar" ? [{ ...person("aryan"), friendship: "none", isFriend: false, canPlay: true }] : [] });
    });
    const model = new PeopleSearchModel(server.api, undefined, 5);
    model.queryChanged("a");
    expect(model.snapshot().phase).toEqual({ kind: "idle" });
    model.queryChanged("@Ar");
    model.queryChanged("  @Ar ");
    expect(model.snapshot().phase).toEqual({ kind: "loading" });
    expect(server.requests).toHaveLength(0);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(server.requests.map((request) => request.query)).toEqual(["q=ar"]); // one search for the two keystrokes
    model.queryChanged("a"); // too short again while the answer is on its way
    wait.open();
    await settle();
    expect(model.snapshot()).toMatchObject({ people: [], phase: { kind: "idle" } });
  });

  it("a failed search is a failure with its message, and nothing is listed", async () => {
    const server = fakeServer(() => "offline");
    const model = new PeopleSearchModel(server.api, undefined, 1);
    model.queryChanged("sara");
    await model.settle();
    expect(model.snapshot()).toMatchObject({ people: [], phase: { kind: "failed", message: new ApiError(0).persianMessage } });
  });
});

// MARK: My friends and the requests

describe("the requests (FriendRequestsModelTests)", () => {
  const request = (username: string, name: string | null = null) => ({ ...person(username, name), createdAt: "2026-11-24T09:00:00.000Z" });
  const page = (items: unknown[], next: string | null = null) => ({ items, nextCursor: next });

  function model(extra: (request: { method: string; path: string }) => ReturnType<typeof none> | ReturnType<typeof ok> = () => none()) {
    const server = fakeServer((r) => {
      if (r.path !== "/v1/me/friend-requests") return extra(r);
      if (r.query.includes("outgoing")) return ok(page([request("paria", "پریا")]));
      return ok(r.query.includes("cursor=2") ? page([request("bardia")]) : page([request("aryan", "آرین")], "2"));
    });
    return { requests: new FriendRequestsModel(server.api), server };
  }

  const names = (list: readonly { username: string }[]) => list.map((item) => item.username);

  it("both lists load all their pages", async () => {
    const { requests } = model();
    await requests.load();
    const state = requests.snapshot();
    expect(state.phase).toEqual({ kind: "loaded" });
    expect([names(state.incoming), names(state.outgoing), state.incomingCount]).toEqual([["aryan", "bardia"], ["paria"], 2]);
  });

  it("a failed load is failed and an empty one is loaded", async () => {
    const server = fakeServer(() => "offline");
    const requests = new FriendRequestsModel(server.api);
    await requests.load();
    expect(requests.snapshot().phase).toEqual({ kind: "failed", message: new ApiError(0).persianMessage });
    server.respond(() => ok(page([])));
    await requests.load();
    expect(requests.snapshot()).toMatchObject({ phase: { kind: "loaded" }, incoming: [], outgoing: [], incomingCount: 0 });
  });

  it("accepting takes the row away and counts one less", async () => {
    const { requests, server } = model(() => ok({ friendship: "friends" }));
    await requests.load();
    expect(await requests.perform("accept", "aryan")).toBeUndefined();
    expect([names(requests.snapshot().incoming), requests.snapshot().incomingCount]).toEqual([["bardia"], 1]);
    expect(server.requests.at(-1)).toMatchObject({ method: "POST", path: "/v1/friend-requests/aryan/accept" });
  });

  it("rejecting just removes the row", async () => {
    const { requests, server } = model();
    await requests.load();
    expect(await requests.perform("reject", "bardia")).toBeUndefined();
    expect([names(requests.snapshot().incoming), requests.snapshot().incomingCount]).toEqual([["aryan"], 1]);
    expect(server.requests.at(-1)).toMatchObject({ method: "POST", path: "/v1/friend-requests/bardia/reject" });
  });

  it("cancelling a request I sent removes it from the sent section", async () => {
    const { requests, server } = model();
    await requests.load();
    expect(await requests.perform("cancel", "paria")).toBeUndefined();
    expect([requests.snapshot().outgoing, requests.snapshot().incomingCount]).toEqual([[], 2]);
    expect(server.requests.at(-1)).toMatchObject({ method: "DELETE", path: "/v1/friend-requests/paria" });
  });

  it("a refused answer brings the row back where it was and says why", async () => {
    const { requests } = model(() => refuse(429, "rate_limited") as never);
    await requests.load();
    expect(await requests.perform("accept", "aryan")).toBe("یه کم بعد دوباره امتحان کن");
    expect(names(requests.snapshot().incoming)).toEqual(["aryan", "bardia"]);
    expect([requests.snapshot().incomingCount, requests.snapshot().pending.size]).toEqual([2, 0]);
  });

  it("a row shows gone before the server answers", async () => {
    const wait = gate();
    const server = fakeServer(async (r) => {
      if (r.path === "/v1/me/friend-requests") return ok(r.query.includes("outgoing") ? page([]) : page([request("aryan"), request("bardia")]));
      await wait.opened;
      return none();
    });
    const slow = new FriendRequestsModel(server.api);
    await slow.load();
    const done = slow.perform("reject", "aryan");
    expect(names(slow.snapshot().incoming)).toEqual(["bardia"]);
    expect(await slow.perform("reject", "aryan")).toBeUndefined(); // gone already: nothing to do
    wait.open();
    await done;
    expect(names(slow.snapshot().incoming)).toEqual(["bardia"]);
  });

  it("an answer given elsewhere takes the row, or lowers the count when the list was not read; blocking takes both directions", async () => {
    const { requests } = model();
    await requests.load();
    requests.answered("aryan");
    expect([names(requests.snapshot().incoming), requests.snapshot().incomingCount]).toEqual([["bardia"], 1]);
    requests.removeAll("paria");
    expect(requests.snapshot().outgoing).toEqual([]);
    requests.removeAll("bardia");
    expect([requests.snapshot().incoming, requests.snapshot().incomingCount]).toEqual([[], 0]);
    requests.answered("nobody");
    expect(requests.snapshot().incomingCount).toBe(0); // never below nothing
  });

  it("the count from the server stands until the list is read, and is told to the tab bar when it changes; signing out clears it", () => {
    const requests = new FriendRequestsModel(fakeServer(() => none()).api);
    const counts: number[] = [];
    requests.onCountChange = (count) => counts.push(count);
    requests.setCount(3);
    requests.setCount(3);
    requests.setCount(4);
    expect(counts).toEqual([3, 4]);
    requests.reset();
    expect([requests.snapshot().incomingCount, requests.snapshot().incoming, counts]).toEqual([0, [], [3, 4, 0]]);
  });

  it("my friends list comes from the friends endpoint as friends", async () => {
    const server = fakeServer(() => ok({ items: [{ ...person("a", "آ"), canPlay: false }, person("b")], nextCursor: null }));
    const friends = new FriendsListModel(server.api);
    await friends.load();
    expect(friends.snapshot().people.map((one) => [one.username, one.friendship, one.isFriend, one.canPlay])).toEqual([["a", "friends", true, false], ["b", "friends", true, true]]);
    expect(server.requests.at(-1)!.path).toBe("/v1/me/friends");
  });
});

// MARK: The badge and what happens elsewhere

describe("the badge and the lists that follow (FriendRequestsCenterTests)", () => {
  const user = { id: "u1" } as never;

  function center(unread: { total: number; friendRequests: number }, after = unread) {
    let written = false;
    const server = fakeServer(({ method, path, query }) => {
      if (path === "/v1/me/unread") return ok(written ? after : unread);
      if (path === "/v1/me/friend-requests") return ok({ items: query.includes("incoming") ? [{ ...person("aryan"), createdAt: "2026-11-24T09:00:00.000Z" }] : [], nextCursor: null });
      written = true;
      return ok({ friendship: "friends" });
    });
    return { center: new FriendsCenter({ user }, server.api), server };
  }

  it("the badge is the unread messages plus the incoming requests", async () => {
    const { center: friends } = center({ total: 2, friendRequests: 3 });
    expect(friends.badge).toBe(0);
    await friends.refreshUnread();
    expect([friends.snapshot().unreadMessages, friends.requests.snapshot().incomingCount, friends.badge]).toEqual([2, 3, 5]);
    friends.reset();
    expect(friends.badge).toBe(0);
  });

  it("accepting a request lowers the badge", async () => {
    const { center: friends } = center({ total: 0, friendRequests: 1 }, { total: 0, friendRequests: 0 });
    const badges: number[] = [];
    friends.requests.onCountChange = () => badges.push(friends.badge);
    await friends.refreshUnread();
    await friends.requests.load();
    expect(await friends.requests.perform("accept", "aryan")).toBeUndefined();
    expect(badges).toEqual([1, 0]);
  });

  it("a failed unread call keeps the badge", async () => {
    const { center: friends, server } = center({ total: 1, friendRequests: 1 });
    await friends.refreshUnread();
    server.respond(() => "offline");
    await friends.refreshUnread();
    expect(friends.badge).toBe(2);
  });

  it("accepting on a person's page lowers the badge at once, refreshes my friends, and reads the server's count again", async () => {
    const { center: friends, server } = center({ total: 0, friendRequests: 2 }, { total: 0, friendRequests: 1 });
    await friends.refreshUnread();
    const model = new PersonModel("aryan", server.api, undefined, friends);
    server.respond(({ method, path }) => (path === "/v1/me/unread" ? ok({ total: 0, friendRequests: 1 }) : method === "GET" ? ok({ ...profile("incoming"), username: "aryan" }) : ok({ friendship: "friends" })));
    await model.load();
    const revision = friends.snapshot().friendsRevision;
    await model.perform("accept");
    expect(friends.requests.snapshot().incomingCount).toBe(1);
    expect(friends.snapshot().friendsRevision).toBe(revision + 1);
    await settle();
    expect(server.to("/v1/me/unread")).toHaveLength(2);
  });

  it("rejecting on a person's page lowers the badge but my friends stay as they were", async () => {
    const { center: friends, server } = center({ total: 0, friendRequests: 2 });
    await friends.refreshUnread();
    server.respond(({ method, path }) => (path === "/v1/me/unread" ? ok({ total: 0, friendRequests: 1 }) : method === "GET" ? ok(profile("incoming")) : none()));
    const model = new PersonModel("sara", server.api, undefined, friends);
    await model.load();
    const revision = friends.snapshot().friendsRevision;
    await model.perform("reject");
    expect(friends.requests.snapshot().incomingCount).toBe(1);
    expect(friends.snapshot().friendsRevision).toBe(revision);
  });

  it("accepting from a search row drops the request row and the count", async () => {
    const { center: friends, server } = center({ total: 0, friendRequests: 1 }, { total: 0, friendRequests: 0 });
    await friends.refreshUnread();
    await friends.requests.load();
    server.respond(({ method, path }) => (path === "/v1/me/unread" ? ok({ total: 0, friendRequests: 0 }) : method === "GET" ? ok({ items: [{ ...person("aryan"), friendship: "incoming", isFriend: false, canPlay: true }] }) : ok({ friendship: "friends" })));
    const search = new PeopleSearchModel(server.api, friends, 1);
    search.queryChanged("ary");
    await search.settle();
    const revision = friends.snapshot().friendsRevision;
    expect(await search.perform("accept", "aryan")).toBeUndefined();
    expect([friends.requests.snapshot().incoming, friends.requests.snapshot().incomingCount, friends.snapshot().friendsRevision]).toEqual([[], 0, revision + 1]);
  });

  it("asking back someone who asked me, or a cancelled request, leaves the sent section", async () => {
    const { center: friends } = center({ total: 0, friendRequests: 1 }, { total: 0, friendRequests: 0 });
    await friends.requests.load();
    friends.friendshipChanged("paria", "cancel", "none");
    friends.friendshipChanged("aryan", "send", "friends");
    expect(friends.requests.snapshot().incoming).toEqual([]);
  });

  it("blocking someone who asked takes their request away, and they are hidden from then on", async () => {
    const { center: friends } = center({ total: 0, friendRequests: 1 }, { total: 0, friendRequests: 0 });
    await friends.requests.load();
    const model = new PersonModel("aryan", fakeServer(() => none()).api, undefined, friends);
    expect(await model.block()).toBe(true);
    expect([friends.requests.snapshot().incoming, friends.requests.snapshot().incomingCount]).toEqual([[], 0]);
    expect(friends.blocked.usernames.has("aryan")).toBe(true);
  });
});
