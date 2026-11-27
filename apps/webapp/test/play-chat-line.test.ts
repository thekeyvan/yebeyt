import { describe, expect, it } from "vitest";
import { gameLine, type GameLine } from "../lib/messages/gameLine";
import type { FriendGame } from "../lib/play/models";
import { game, niloofar, player, saraMove } from "./play";
import { message, sara as chatSara } from "./messages";

// The port of ChatGameLineTests: the game lines of a chat, what each message draws.

const sara = { ...chatSara, username: "sara.ghazal" };
const line = (fromMe: boolean, payload: Record<string, unknown>, kind: "game" | "system" = "game") => message("m1", { kind, fromMe, text: null, payload: payload as never });
const card = (it: ReturnType<typeof line>, found?: FriendGame, myId: string | undefined = "u1") => gameLine(it, sara, found, "niloofar", myId);
const invite = (kind = "mosh", id = "g1") => line(false, { event: "game_invite", gameId: id, kind, code: "M4R9" });

describe("the game lines of a chat", () => {
  it("has «بزن بریم» on an invitation you can join", () => {
    const expected: GameLine = { kind: "invite", text: "سارا دعوتت کرد به مشاعره", button: { title: "بزن بریم", action: { kind: "join", gameId: "g1" } } };
    expect(card(invite())).toEqual(expected);
    expect(card(invite(), game({ status: "waiting", players: [player("sara.ghazal", 0, 0, "سارا")], turn: null }))).toEqual(expected); // while it waits for the second player
  });

  it("opens the game from an invitation of mine", () => {
    expect(card(line(true, { event: "game_invite", gameId: "g1", kind: "duel", code: "M4R9" }))).toEqual({ kind: "invite", text: "دعوتش کردی به بازی رودررو", button: { title: "ببین", action: { kind: "open", gameId: "g1" } } });
  });

  it("is the card of the board for a مشاعره that started", () => {
    const shown = card(invite(), game({ moves: [saraMove] }));
    expect(shown).toMatchObject({ kind: "mosh", gameId: "g1" });
    if (shown?.kind !== "mosh") throw new Error("not the mosh card");
    expect([shown.state.isMyTurn, shown.state.requiredLetter, shown.state.turnLine, shown.state.roundLine]).toEqual([true, "د", "نوبت توئه، با حرف «د»", "دور ۲ · تا فردا"]);
  });

  it("keeps the card of a finished مشاعره with its result, and a finished رودررو is a sentence", () => {
    const done = game({ status: "done", winner: "niloofar", endReason: "resigned", turn: null, moves: [saraMove] });
    const shown = card(invite(), done);
    if (shown?.kind !== "mosh") throw new Error("not the mosh card");
    expect([shown.state.isDone, shown.state.outcomeTitle, shown.state.endLine]).toEqual([true, "بردی!", "سارا کم آورد"]);
    const duelDone = game({ id: "d1", kind: "duel", turnSeconds: 8, status: "done", winner: "sara.ghazal", endReason: "finished", turn: null, players: [niloofar, player("sara.ghazal", 0, 0, "سارا")] });
    expect(card(invite("duel", "d1"), duelDone)).toEqual({ kind: "invite", text: "بازی رودررو با سارا · سارا برد" });
  });

  it("can open a رودررو that is on again", () => {
    const active = game({ id: "d1", kind: "duel", turnSeconds: 8, turn: null });
    expect(card(invite("duel", "d1"), active)).toEqual({ kind: "invite", text: "بازی رودررو با سارا · الان در جریانه", button: { title: "بزن بریم", action: { kind: "open", gameId: "d1" } } });
  });

  it("is a line for the result of a challenge", () => {
    expect(card(line(false, { event: "challenge_result", code: "7KQ2", game: "jigsaw", score: 7, seconds: 90 }))).toEqual({ kind: "line", text: "سارا توی چالشت ۷ از ۱۰ گرفت" });
    expect(card(line(true, { event: "challenge_result", code: "7KQ2", game: "poet", score: 9, seconds: 50 }))).toEqual({ kind: "line", text: "توی چالش سارا ۹ از ۱۰ گرفتی" });
  });

  it("is a line with who won for a game that ended", () => {
    const ended = (by?: string) => line(false, { event: "game_ended", gameId: "g1", kind: "mosh", reason: "timeout", ...(by ? { by } : {}) }, "system");
    expect(card(ended("u1"))).toEqual({ kind: "line", text: "مشاعره با سارا تموم شد · بردی!" });
    expect(card(ended("u2"))).toEqual({ kind: "line", text: "مشاعره با سارا تموم شد · سارا برد" });
    expect(card(ended())).toEqual({ kind: "line", text: "مشاعره با سارا تموم شد · مساوی" });
  });

  it("does not draw other messages", () => {
    expect(card(message("m1", { text: "سلام" }))).toBeUndefined();
    expect(card(line(false, { event: "something_new" }))).toBeUndefined();
  });

  it("has the payload of a game message", () => {
    const shown = invite();
    expect(shown.payload).toMatchObject({ gameId: "g1", code: "M4R9", kind: "mosh" });
  });
});
