import { describe, expect, it } from "vitest";
import { ChatModel } from "../lib/messages/chat";
import { fakeServer, gate, none, ok, refuse, type Answer } from "./friends";
import { message, now, page, sara, utc } from "./messages";

// The ports of ChatModelTests.swift.

const text = (id: string, mine = false, at = "2026-11-24T09:40:00.000Z") => message(id, { fromMe: mine, createdAt: at, text: "سلام" });

function rig(handler: Parameters<typeof fakeServer>[0] = () => refuse(404, "not_found")) {
  const server = fakeServer(handler);
  let next = 0;
  const model = new ChatModel({ id: "c1", other: sara }, server.api, () => now, () => `new-${(next += 1)}`);
  const sends = () => server.requests.filter((request) => request.method === "POST" && request.path === "/v1/conversations/c1/messages");
  const reads = () => server.requests.filter((request) => request.method === "PUT" && request.path === "/v1/conversations/c1/read");
  return { ...server, model, sends, reads };
}

const entriesOf = (model: ChatModel) => model.entries(now, utc);

describe("paging", () => {
  it("the newest page comes first and older ones are added at the top", async () => {
    const newest = page([text("m4", false, "2026-11-24T09:04:00Z"), text("m3", false, "2026-11-24T09:03:00Z")], { before: "m3" });
    const older = page([text("m2", false, "2026-11-24T09:02:00Z"), text("m1", false, "2026-11-24T09:01:00Z")]);
    const r = rig((request) => ok(request.query.includes("before=m3") ? older : newest));
    await r.model.load();
    expect(r.model.snapshot().phase.kind).toBe("loaded");
    expect(r.model.snapshot().messages.map((one) => one.id)).toEqual(["m3", "m4"]);
    expect(r.model.snapshot().hasOlder).toBe(true);
    await r.model.loadOlder();
    expect(r.model.snapshot().messages.map((one) => one.id)).toEqual(["m1", "m2", "m3", "m4"]);
    expect(r.model.snapshot().hasOlder).toBe(false);
    await r.model.loadOlder(); // nothing more to ask
    expect(r.requests).toHaveLength(2);
    await r.model.load(); // a reconnect doesn't double anything
    expect(r.model.snapshot().messages.map((one) => one.id)).toEqual(["m1", "m2", "m3", "m4"]);
    expect(r.model.snapshot().hasOlder).toBe(false);
  });

  it("a failed first load shows its reason, and an empty chat is loaded", async () => {
    const r = rig(() => "offline");
    await r.model.load();
    expect(r.model.snapshot().phase).toEqual({ kind: "failed", message: "اینترنت نیست؛ یه بار دیگه امتحان کن." });
    r.respond(() => ok(page([])));
    await r.model.load();
    expect(r.model.snapshot().phase.kind).toBe("loaded");
    expect(entriesOf(r.model)).toEqual([]);
  });
});

describe("sending", () => {
  it("a text is in the list at once and becomes the server's message", async () => {
    const answer = gate();
    const r = rig(async () => {
      await answer.opened;
      return ok(message("m9", { fromMe: true, text: "سلام سارا", createdAt: "2026-11-24T12:00:01Z" }));
    });
    expect(r.model.send("  سلام سارا \n")).toBe(true);
    expect(r.model.snapshot().pending).toHaveLength(1);
    expect(r.model.snapshot().pending[0]!.failed).toBe(false);
    const entries = entriesOf(r.model);
    expect(entries.map((entry) => entry.kind)).toEqual(["day", "pending"]); // «امروز» and the send on its way
    expect(entries[0]).toMatchObject({ label: "امروز" });
    expect(entries[1]).toMatchObject({ pending: { clientId: "new-1" } });
    answer.open();
    await r.model.settle();
    expect(r.model.snapshot().pending).toEqual([]);
    expect(r.model.snapshot().messages.map((one) => one.id)).toEqual(["m9"]);
    expect(r.sends()[0]!.json).toEqual({ clientId: "new-1", kind: "text", text: "سلام سارا" });
  });

  it("sends nothing for empty text and cuts long text", async () => {
    const r = rig(() => ok(message("m1", { fromMe: true })));
    expect(r.model.send(" \n ")).toBe(false);
    expect(r.model.snapshot().pending).toEqual([]);
    expect(r.model.send("ا".repeat(1500))).toBe(true);
    await r.model.settle();
    expect((r.sends()[0]!.json!.text as string).length).toBe(1000);
  });

  it("counts UTF-16 units like the server, and never cuts an emoji in half", async () => {
    const r = rig(() => ok(message("m1", { fromMe: true })));
    r.model.send("😀".repeat(700)); // 2 units each: 500 fit in 1000
    r.model.sendCouplet("/hafez/ghazal/sh3#0", "😀".repeat(150) + "ا");
    await r.model.settle();
    const bodies = r.sends().map((request) => request.json!);
    const body = bodies.find((one) => one.text)!.text as string;
    expect(body.length).toBe(1000);
    expect([...body]).toHaveLength(500);
    const note = bodies.find((one) => one.note)!.note as string;
    expect(note.length).toBe(200);
    expect([...note]).toHaveLength(100);
  });

  it("a couplet goes with its key, and the note only when there is one", async () => {
    const r = rig(() => ok(message("m1", { kind: "couplet", fromMe: true, key: "/hafez/ghazal/sh3#0" })));
    r.model.sendCouplet("/hafez/ghazal/sh3#0", "  اینو دیدم  ");
    r.model.sendCouplet("/hafez/ghazal/sh3#1", "   ");
    await r.model.settle();
    const bodies = r.sends().map((request) => request.json!);
    expect(bodies).toHaveLength(2);
    expect(bodies.every((one) => one.kind === "couplet")).toBe(true);
    expect(bodies.flatMap((one) => (one.note ? [one.note] : []))).toEqual(["اینو دیدم"]);
    expect(bodies.map((one) => one.key).sort()).toEqual(["/hafez/ghazal/sh3#0", "/hafez/ghazal/sh3#1"]);
  });

  it("a failed send waits for a retry that uses the same clientId", async () => {
    const r = rig(() => "offline");
    r.model.send("سلام");
    await r.model.settle();
    expect(r.model.snapshot().pending).toHaveLength(1);
    expect(r.model.snapshot().pending[0]!.failed).toBe(true);
    expect(r.model.snapshot().toast).toBeUndefined(); // the bubble says it, not a toast
    r.respond(() => ok(message("m1", { fromMe: true })));
    r.model.retry("new-1");
    expect(r.model.snapshot().pending[0]!.failed).toBe(false);
    r.model.retry("new-1"); // a second tap while it is on its way does nothing
    await r.model.settle();
    expect(r.model.snapshot().pending).toEqual([]);
    expect(r.model.snapshot().messages.map((one) => one.id)).toEqual(["m1"]);
    expect(r.sends()).toHaveLength(2);
    expect(new Set(r.sends().map((request) => request.json!.clientId))).toEqual(new Set(["new-1"]));
  });

  it("a failed send can be thrown away", async () => {
    const r = rig(() => "offline");
    r.model.send("سلام");
    await r.model.settle();
    r.model.discard("new-1");
    expect(r.model.snapshot().pending).toEqual([]);
    expect(entriesOf(r.model)).toEqual([]);
  });

  it("the event of my own send does not make a second bubble", async () => {
    const answer = gate();
    const mine = message("m1", { fromMe: true });
    const r = rig(async () => {
      await answer.opened;
      return ok(mine);
    });
    r.model.send("سلام");
    r.model.apply({ type: "message", message: mine }); // the live event is faster than the answer
    expect(r.model.snapshot().pending).toEqual([]);
    expect(r.model.snapshot().messages).toHaveLength(1);
    answer.open();
    await r.model.settle();
    expect(r.model.snapshot().messages.map((one) => one.id)).toEqual(["m1"]);
    expect(entriesOf(r.model)).toHaveLength(2); // the day and one bubble
  });

  it("a sent bubble keeps its row id when the server's message replaces it", async () => {
    const answer = gate();
    const r = rig(async () => {
      await answer.opened;
      return ok(message("m1", { fromMe: true }));
    });
    r.model.send("سلام");
    const sending = entriesOf(r.model).at(-1)!;
    expect(sending.id).toBe("new-1");
    answer.open();
    await r.model.settle();
    const sent = entriesOf(r.model).at(-1)!;
    expect(sent.id).toBe("m1");
    expect(sent.rowId).toBe(sending.rowId); // one row, so the list springs it in once
  });

  it("the live event before the answer keeps the row id too, and a message of someone else is keyed by its own", () => {
    const r = rig(() => new Promise<Answer>(() => {}));
    r.model.send("سلام");
    const sending = entriesOf(r.model).at(-1)!;
    r.model.apply({ type: "message", message: message("m1", { fromMe: true }) });
    expect(entriesOf(r.model).at(-1)!.rowId).toBe(sending.rowId);
    r.model.apply({ type: "message", message: message("m2", { text: "سلام" }) });
    expect(entriesOf(r.model).at(-1)!.rowId).toBe("m2");
  });

  it("a second phone of mine shows up as an ordinary message", () => {
    const r = rig();
    r.model.apply({ type: "message", message: message("m1", { fromMe: true, text: "از گوشی دیگه" }) });
    expect(r.model.snapshot().messages.map((one) => one.id)).toEqual(["m1"]);
    expect(r.model.snapshot().pending).toEqual([]);
  });

  it("a closed chat takes no more sends, and what was typed stays, refused", async () => {
    const r = rig(() => refuse(403, "messages_closed"));
    r.model.send("سلام");
    await r.model.settle();
    expect(r.model.snapshot().isClosed).toBe(true);
    expect(r.model.send("دوباره")).toBe(false);
    expect(r.sends()).toHaveLength(1);
    expect(r.model.snapshot().pending.map((one) => one.refused)).toEqual([true]);
    r.model.retry("new-1");
    await r.model.settle();
    expect(r.sends()).toHaveLength(1);
  });

  it("too many sends say slow down and keep the message for a retry", async () => {
    const r = rig(() => refuse(429, "rate_limited"));
    r.model.send("سلام");
    await r.model.settle();
    expect(r.model.snapshot().toast?.line).toBe("یه کم آروم‌تر");
    expect(r.model.snapshot().pending.map((one) => one.failed)).toEqual([true]);
    expect(r.model.snapshot().isClosed).toBe(false);
  });
});

describe("read receipts", () => {
  it("«دیده شد» goes under my last message the other person has read, and follows the read mark", async () => {
    const items = [text("m5", true, "2026-11-24T09:05:00Z"), text("m4", true, "2026-11-24T09:04:00Z"), text("m3", false, "2026-11-24T09:03:00Z"), text("m2", true, "2026-11-24T09:02:00Z"), text("m1", false, "2026-11-24T09:01:00Z")];
    const r = rig(() => ok(page(items, { otherRead: "m3" })));
    await r.model.load();
    expect(r.model.seenMessageId).toBe("m2");
    expect(entriesOf(r.model).filter((entry) => entry.kind === "message" && entry.seen).map((entry) => entry.id)).toEqual(["m2"]);
    r.model.apply({ type: "read", conversationId: "c1", username: "sara", messageId: "m5" });
    expect(r.model.seenMessageId).toBe("m5");
    // Someone else's read mark, or another chat's, changes nothing.
    r.model.apply({ type: "read", conversationId: "c2", username: "sara", messageId: "m1" });
    r.model.apply({ type: "read", conversationId: "c1", username: "arian", messageId: "m1" });
    expect(r.model.seenMessageId).toBe("m5");
  });

  it("nothing is seen when the read message is not mine or not there", async () => {
    const r = rig(() => ok(page([text("m2", false, "2026-11-24T09:02:00Z"), text("m1", true, "2026-11-24T09:01:00Z")])));
    await r.model.load();
    expect(r.model.seenMessageId).toBeUndefined();
    r.model.apply({ type: "read", conversationId: "c1", username: "sara", messageId: "unknown" });
    expect(r.model.seenMessageId).toBeUndefined();
  });

  it("the newest message is marked read once while the chat is on screen", async () => {
    const r = rig((request) => (request.method === "PUT" ? none() : ok(page([text("m2", false, "2026-11-24T09:02:00Z"), text("m1", false, "2026-11-24T09:01:00Z")]))));
    let asked = 0;
    r.model.onRead = () => (asked += 1);
    await r.model.load();
    await r.model.settle();
    expect(r.reads()).toEqual([]); // not on screen yet
    r.model.setVisible(true);
    await r.model.settle();
    expect(r.reads().map((request) => request.json!.messageId)).toEqual(["m2"]);
    expect(asked).toBe(1);
    r.model.markRead(); // nothing new
    await r.model.settle();
    expect(r.reads()).toHaveLength(1);
    r.model.apply({ type: "message", message: text("m3", false, "2026-11-24T09:03:00Z") });
    await r.model.settle();
    expect(r.reads().map((request) => request.json!.messageId)).toEqual(["m2", "m3"]);
    r.model.setVisible(false);
    r.model.apply({ type: "message", message: text("m4", false, "2026-11-24T09:04:00Z") });
    await r.model.settle();
    expect(r.reads()).toHaveLength(2); // away: it waits
  });

  it("a failed read mark is tried again with the next message", async () => {
    const r = rig((request) => (request.method === "PUT" ? "offline" : ok(page([text("m1")]))));
    r.model.setVisible(true);
    await r.model.load();
    await r.model.settle();
    r.model.markRead();
    await r.model.settle();
    expect(r.reads()).toHaveLength(2);
  });

  it("the first visible load always sends the read mark, even after an answer of mine", async () => {
    const r = rig((request) => (request.method === "PUT" ? none() : ok(page([text("m2", true, "2026-11-24T09:02:00Z"), text("m1", false, "2026-11-24T09:01:00Z")]))));
    r.model.setVisible(true);
    await r.model.load();
    await r.model.settle();
    expect(r.reads().map((request) => request.json!.messageId)).toEqual(["m2"]);
  });

  it("a game line of theirs is unread and gets marked read", async () => {
    const line = message("g1", { kind: "game", text: null, payload: { event: "game_invite", kind: "duel" }, createdAt: "2026-11-24T09:02:00Z" });
    const r = rig((request) => (request.method === "PUT" ? none() : ok(page([line]))));
    r.model.setVisible(true);
    await r.model.load();
    await r.model.settle();
    expect(r.reads().map((request) => request.json!.messageId)).toEqual(["g1"]);
  });
});

describe("deleting and reporting", () => {
  it("a deleted event clears the message and keeps its place", async () => {
    const couplet = message("m1", { kind: "couplet", text: null, key: "/hafez/ghazal/sh3#0", note: "یادت", createdAt: "2026-11-24T09:01:00Z" });
    const r = rig(() => ok(page([text("m2", false, "2026-11-24T09:02:00Z"), couplet])));
    await r.model.load();
    r.model.apply({ type: "deleted", conversationId: "c1", messageId: "m1" });
    const [deleted] = r.model.snapshot().messages;
    expect(deleted).toMatchObject({ id: "m1", deleted: true, key: null, note: null, text: null });
    expect(r.model.snapshot().messages.map((one) => one.id)).toEqual(["m1", "m2"]);
    r.model.apply({ type: "deleted", conversationId: "other", messageId: "m2" });
    expect(r.model.snapshot().messages[1]!.deleted).toBe(false);
  });

  it("deleting my message asks the server, then clears it", async () => {
    const r = rig((request) => (request.method === "DELETE" ? none() : ok(page([text("m1", true)]))));
    await r.model.load();
    await r.model.delete(r.model.snapshot().messages[0]!);
    expect(r.requests.some((request) => request.method === "DELETE" && request.path === "/v1/messages/m1")).toBe(true);
    expect(r.model.snapshot().messages[0]!.deleted).toBe(true);
  });

  it("a message of the other person is never deleted from here", async () => {
    const r = rig(() => ok(page([text("m1")])));
    await r.model.load();
    await r.model.delete(r.model.snapshot().messages[0]!);
    expect(r.requests.some((request) => request.method === "DELETE")).toBe(false);
    expect(r.model.snapshot().messages[0]!.deleted).toBe(false);
  });

  it("a delete that fails keeps the message and says why", async () => {
    const r = rig((request) => (request.method === "DELETE" ? "offline" : ok(page([text("m1", true)]))));
    await r.model.load();
    await r.model.delete(r.model.snapshot().messages[0]!);
    expect(r.model.snapshot().messages[0]!.deleted).toBe(false);
    expect(r.model.snapshot().toast?.line).toBe("اینترنت نیست؛ یه بار دیگه امتحان کن.");
  });

  it("a report names the person, the message and the reason", async () => {
    const r = rig((request) => (request.method === "POST" ? none() : ok(page([text("m1")]))));
    await r.model.load();
    await r.model.report(r.model.snapshot().messages[0]!, "abuse");
    expect(r.requests.find((request) => request.path === "/v1/reports")!.json).toEqual({ username: "sara", messageId: "m1", reason: "abuse" });
    expect(r.model.snapshot().toast?.line).toBe("گزارشت رسید");
  });
});

describe("the list", () => {
  it("days are labelled in Persian and messages keep their order", async () => {
    const r = rig(() =>
      ok(page([text("m5", false, "2026-11-24T11:00:00Z"), text("m4", false, "2026-11-24T08:00:00Z"), text("m3", false, "2026-11-23T20:00:00Z"), text("m2", false, "2026-11-21T09:00:00Z"), text("m1", false, "2026-11-10T09:00:00Z")])),
    );
    await r.model.load();
    const entries = entriesOf(r.model);
    expect(entries.flatMap((entry) => (entry.kind === "day" ? [entry.label] : []))).toEqual(["۱۹ آبان", "شنبه", "دیروز", "امروز"]);
    expect(entries.map((entry) => (entry.kind === "day" ? `day:${entry.label}` : entry.id))).toEqual(["day:۱۹ آبان", "m1", "day:شنبه", "m2", "day:دیروز", "m3", "day:امروز", "m4", "m5"]);
  });

  it("a send on its way gets today's label when the last message is older", async () => {
    const r = rig(() => ok(page([text("m1", false, "2026-11-23T09:00:00Z")])));
    await r.model.load();
    r.respond(() => "offline");
    r.model.send("سلام");
    await r.model.settle();
    expect(entriesOf(r.model).flatMap((entry) => (entry.kind === "day" ? [entry.label] : []))).toEqual(["دیروز", "امروز"]);
  });

  it("the divan line, the game lines and the challenge's result are shown, and others are not", async () => {
    const r = rig(() =>
      ok(
        page([
          message("m5", { kind: "system", text: null, payload: { event: "something_new" }, createdAt: "2026-11-24T09:05:00Z" }),
          message("m4", { kind: "game", text: null, payload: { event: "challenge_result", code: "AB12" }, createdAt: "2026-11-24T09:04:00Z" }),
          message("m3", { kind: "game", text: null, payload: { event: "game_invite", kind: "mosh" }, createdAt: "2026-11-24T09:03:00Z" }),
          message("m2", { kind: "system", text: null, payload: { event: "game_ended", kind: "mosh" }, createdAt: "2026-11-24T09:02:00Z" }),
          message("m1", { kind: "system", text: null, payload: { event: "divan_add", key: "/hafez/ghazal/sh3#0" }, createdAt: "2026-11-24T09:01:00Z" }),
        ]),
      ),
    );
    await r.model.load();
    expect(entriesOf(r.model).flatMap((entry) => (entry.kind === "message" ? [entry.id] : []))).toEqual(["m1", "m2", "m3", "m4"]);
  });
});

describe("the header", () => {
  it("online shows only when allowed, and presence changes it", async () => {
    const r = rig((request) => (request.path === "/v1/users/sara" ? ok({ username: "sara", league: { tier: 2 } }) : refuse(404, "not_found")));
    expect(r.model.statusLine).toBe("آنلاین");
    await r.model.loadLeague();
    expect(r.model.statusLine).toBe("آنلاین · لیگ غزل‌باز");
    r.model.apply({ type: "presence", username: "sara", online: false });
    expect(r.model.statusLine).toBe("لیگ غزل‌باز");
    r.model.apply({ type: "presence", username: "arian", online: true });
    expect(r.model.snapshot().other.online).toBe(false);
  });

  it("a person who hides online has no online word, and is called by the username when they have no name", () => {
    const server = fakeServer(() => refuse(404, "not_found"));
    const model = new ChatModel({ id: "c1", other: { username: "sara", displayName: null, avatar: null, online: null } }, server.api);
    expect(model.statusLine).toBeUndefined();
  });

  it("the same toast shown again starts its time over", () => {
    const r = rig();
    r.model.showToast("نرسید");
    const before = r.model.snapshot().toast!.serial;
    r.model.showToast("نرسید");
    expect(r.model.snapshot().toast!.serial).toBe(before + 1);
  });
});
