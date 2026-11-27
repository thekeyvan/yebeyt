import { describe, expect, it } from "vitest";
import { ApiError, messageOf } from "../lib/account/api";
import { chatTime, gameName, leagueLine, limited, messageCopy, messageToast, parseCoupletKey, reportReasons } from "../lib/messages/copy";
import { gameLine } from "../lib/messages/gameLine";
import { CoupletResolver } from "../lib/messages/resolver";
import { chatName } from "../lib/messages/models";
import type { Poem } from "../lib/poetry/models";
import { fakeServer, none, ok } from "./friends";
import { message, now, sara, utc } from "./messages";

describe("the lead's lines (MessageCopyTests)", () => {
  it("errors become the lead's lines, and nothing technical reaches the screen", () => {
    const line = (status: number, code?: string, divan = false) => messageToast(new ApiError(status, code), divan);
    expect(line(429, "rate_limited")).toBe("یه کم آروم‌تر");
    expect(line(429)).toBe("یه کم آروم‌تر");
    expect(line(403, "messages_closed")).toBe("دیگه نمی‌تونی به این گفتگو پیام بدی");
    expect(line(403, "forbidden", true)).toBe("فقط با دوستات می‌شه دیوان مشترک داشت");
    expect(line(403, "forbidden")).toBe(messageOf(new ApiError(403, "forbidden")));
    expect(messageToast(new ApiError(0))).toBe(messageOf(new ApiError(0)));
    expect(line(500, "internal_error")).toBe(messageOf(new ApiError(500)));
  });

  it("the lines of the chat are the lead's copy", () => {
    expect(messageCopy.notSent).toBe("نرسید · دوباره");
    expect(messageCopy.sending).toBe("در حال فرستادن");
    expect(messageCopy.seen).toBe("دیده شد");
    expect(gameName("duel")).toBe("بازی رودررو");
    expect(gameName("mosh")).toBe("مشاعره");
    expect(gameName(undefined)).toBe("بازی");
  });

  it("the report reasons are the three of the friends slice", () => {
    expect(reportReasons.map((one) => one.title)).toEqual(["اسپم", "بی‌احترامی", "یه چیز دیگه"]);
    expect(reportReasons.map((one) => one.reason)).toEqual(["spam", "abuse", "other"]);
  });

  it("times are in Persian digits and days are labelled", () => {
    const at = (iso: string) => new Date(iso);
    expect(chatTime.clock(at("2026-11-24T09:45:00Z"), utc)).toBe("۹:۴۵");
    expect(chatTime.clock(at("2026-11-24T09:05:00Z"), utc)).toBe("۹:۰۵");
    expect(chatTime.clock(at("2026-11-24T00:00:00Z"), utc)).toBe("۰:۰۰");
    expect(chatTime.day(at("2026-11-24T00:01:00Z"), now, utc)).toBe("امروز");
    expect(chatTime.day(at("2026-11-23T23:59:00Z"), now, utc)).toBe("دیروز");
    expect(chatTime.day(at("2026-11-21T10:00:00Z"), now, utc)).toBe("شنبه");
    expect(chatTime.day(at("2026-11-18T10:00:00Z"), now, utc)).toBe("چهارشنبه"); // six days back
    expect(chatTime.day(at("2026-11-17T10:00:00Z"), now, utc)).toBe("۲۶ آبان");
    // The inbox shows the time for today and the day's label for the rest.
    expect(chatTime.stamp(at("2026-11-24T09:45:00Z"), now, utc)).toBe("۹:۴۵");
    expect(chatTime.stamp(at("2026-11-23T09:45:00Z"), now, utc)).toBe("دیروز");
  });

  it("the days of the cards are written as on the board", () => {
    const line = (iso: string) => chatTime.added(new Date(iso), now, utc);
    expect(line("2026-11-24T08:00:00Z")).toBe("امروز");
    expect(line("2026-11-23T08:00:00Z")).toBe("دیروز");
    expect(line("2026-11-21T08:00:00Z")).toBe("۳ روز پیش");
    expect(line("2026-11-15T08:00:00Z")).toBe("هفته‌ی پیش");
    expect(line("2026-10-01T08:00:00Z")).toBe("۹ مهر");
  });

  it("league tiers are named like the levels, and couplet keys are parsed", () => {
    expect(leagueLine(2)).toBe("لیگ غزل‌باز");
    expect(leagueLine(0)).toBe("لیگ نوآموز");
    expect(leagueLine(5)).toBeUndefined();
    expect(parseCoupletKey("/hafez/ghazal/sh3#1")).toEqual({ path: "/hafez/ghazal/sh3", index: 1 });
    for (const key of ["hafez#1", "/hafez/ghazal/sh3", "/hafez/ghazal/sh3#x", "/#1", "#1", ""]) expect(parseCoupletKey(key), key).toBeUndefined();
  });

  it("limits count UTF-16 units and never cut a letter in half", () => {
    expect(limited("ab😀", 3)).toBe("ab");
    expect(limited("abc", 3)).toBe("abc");
    expect(chatName({ username: "sara", displayName: "  " })).toBe("sara");
    expect(chatName(sara)).toBe("سارا");
  });
});

describe("the game lines of a chat (ChatGameLineTests, until the games with friends are on the web)", () => {
  const game = (fromMe: boolean, payload: Record<string, unknown>, kind: "game" | "system" = "game") => message("m1", { kind, fromMe, text: null, payload: payload as never });

  it("an invitation of theirs has «بزن بریم», one of mine «ببین»", () => {
    const invite = { event: "game_invite", gameId: "g1", kind: "mosh", code: "M4R9" };
    expect(gameLine(game(false, invite), sara, "u1")).toEqual({ kind: "invite", text: "سارا دعوتت کرد به مشاعره", button: { title: "بزن بریم" } });
    expect(gameLine(game(true, { ...invite, kind: "duel" }), sara, "u1")).toEqual({ kind: "invite", text: "دعوتش کردی به بازی رودررو", button: { title: "ببین" } });
  });

  it("the result of a challenge is a line", () => {
    expect(gameLine(game(false, { event: "challenge_result", code: "7KQ2", game: "jigsaw", score: 7, seconds: 90 }), sara, "u1")).toEqual({ kind: "line", text: "سارا توی چالشت ۷ از ۱۰ گرفت" });
    expect(gameLine(game(true, { event: "challenge_result", score: 9 }), sara, "u1")).toEqual({ kind: "line", text: "توی چالش سارا ۹ از ۱۰ گرفتی" });
  });

  it("a game that ended is a line with who won", () => {
    const ended = (by?: string) => game(false, { event: "game_ended", gameId: "g1", kind: "mosh", reason: "timeout", ...(by ? { by } : {}) }, "system");
    expect(gameLine(ended("u1"), sara, "u1")).toEqual({ kind: "line", text: "مشاعره با سارا تموم شد · بردی!" });
    expect(gameLine(ended("u2"), sara, "u1")).toEqual({ kind: "line", text: "مشاعره با سارا تموم شد · سارا برد" });
    expect(gameLine(ended(), sara, "u1")).toEqual({ kind: "line", text: "مشاعره با سارا تموم شد · مساوی" });
  });

  it("other messages are not game lines", () => {
    expect(gameLine(message("m1", { text: "سلام" }), sara, "u1")).toBeUndefined();
    expect(gameLine(game(false, { event: "something_new" }), sara, "u1")).toBeUndefined();
  });
});

describe("finding a couplet by its key (CoupletResolver)", () => {
  const poem: Poem = { id: 1, title: "غزل شمارهٔ ۳", path: "/hafez/ghazal/sh3", couplets: [{ m1: "اگر آن ترک شیرازی", m2: "به دست آرد دل ما را" }] };
  const store = { poem: async (path: string) => (path === poem.path ? poem : Promise.reject(new Error("missing"))), poetOf: (path: string) => (path.startsWith("/hafez/") ? ({ slug: "hafez", nickname: "حافظ" } as never) : undefined) };

  it("finds the couplet, its poet and its short title, and keeps what it found", async () => {
    let opened = 0;
    const resolver = new CoupletResolver(async () => (opened += 1, store));
    const found = await resolver.resolve("/hafez/ghazal/sh3#0");
    expect(found).toMatchObject({ poetSlug: "hafez", poetName: "حافظ", title: "غزل ۳", index: 0, path: "/hafez/ghazal/sh3" });
    expect(found?.couplet.m1.startsWith("اگر آن")).toBe(true);
    await resolver.resolve("/hafez/ghazal/sh3#0");
    expect(opened).toBe(1);
  });

  it("finds nothing for a couplet that is not there, a key that is no key, or a poem that cannot be loaded", async () => {
    const resolver = new CoupletResolver(async () => store);
    expect(await resolver.resolve("/hafez/ghazal/sh3#999")).toBeUndefined();
    expect(await resolver.resolve("nonsense")).toBeUndefined();
    expect(await resolver.resolve("/hafez/ghazal/sh4#0")).toBeUndefined();
  });
});

describe("the calls of messages", () => {
  it("each goes to its path with its method, body and query", async () => {
    const s = fakeServer((request) => (request.method === "GET" && request.path === "/v1/users/sara" ? ok({ league: { tier: 3 } }) : none()));
    const { api } = s;
    await api.conversations("c");
    await api.openConversation("sara");
    await api.messages("c1", "m3");
    await api.sendMessage("c1", "k1", { kind: "couplet", key: "/hafez/ghazal/sh3#0", note: "n" });
    await api.markRead("c1", "m1");
    await api.deleteMessage("m1");
    expect(await api.leagueTier("sara")).toBe(3);
    await api.sharedDivans("p");
    await api.openSharedDivan("sara");
    await api.sharedDivanItems("d1", "them", "x");
    await api.addSharedDivanItem("d1", "/a/b#0");
    await api.removeSharedDivanItem("d1", "i1");
    await api.setSharedDivanLike("d1", "i1", true);
    await api.setSharedDivanLike("d1", "i1", false);
    expect(s.requests.map((request) => `${request.method} ${request.path}${request.query ? `?${request.query}` : ""}`)).toEqual([
      "GET /v1/conversations?cursor=c",
      "POST /v1/conversations",
      "GET /v1/conversations/c1/messages?before=m3",
      "POST /v1/conversations/c1/messages",
      "PUT /v1/conversations/c1/read",
      "DELETE /v1/messages/m1",
      "GET /v1/users/sara",
      "GET /v1/shared-divans?cursor=p",
      "POST /v1/shared-divans",
      "GET /v1/shared-divans/d1/items?by=them&cursor=x",
      "POST /v1/shared-divans/d1/items",
      "DELETE /v1/shared-divans/d1/items/i1",
      "PUT /v1/shared-divans/d1/items/i1/like",
      "DELETE /v1/shared-divans/d1/items/i1/like",
    ]);
    expect(s.requests[3]!.json).toEqual({ clientId: "k1", kind: "couplet", key: "/hafez/ghazal/sh3#0", note: "n" });
  });
});
