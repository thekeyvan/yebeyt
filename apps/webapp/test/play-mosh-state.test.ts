import { describe, expect, it } from "vitest";
import { ApiError } from "../lib/account/api";
import { playCopy } from "../lib/play/copy";
import { MoshState } from "../lib/play/moshState";
import { game, niloofar, player, sara, saraMove } from "./play";

// The port of MoshStateTests.swift.

const state = (extra: Parameters<typeof game>[0] = {}, me = "niloofar") => new MoshState(game(extra), me);
const at = (iso: string) => Date.parse(iso);

describe("MoshState", () => {
  it("works out whose turn it is, the scores and the letter from the game", () => {
    const mosh = state({ moves: [saraMove] });
    expect(mosh.isMyTurn).toBe(true);
    expect(mosh.requiredLetter).toBe("د");
    expect([mosh.theirScore, mosh.myScore]).toEqual([1, 0]);
    expect(mosh.round).toBe(2);
    expect(mosh.roundLine).toBe("دور ۲ · تا فردا");
    expect(mosh.turnLine).toBe("نوبت توئه، با حرف «د»");
    expect(mosh.usedKeys).toEqual(new Set(["/hafez/ghazal/sh2#0"]));
    expect(mosh.otherName).toBe("سارا");
  });

  it("is not my turn for the other player", () => {
    const theirs = state({ turn: { username: "sara.ghazal", deadline: "2026-11-25T09:40:00.000Z" }, moves: [saraMove] });
    expect(theirs.isMyTurn).toBe(false);
    expect(theirs.turnLine).toBe("منتظر سارا…");
  });

  it("makes the first couplet free", () => {
    const first = state();
    expect(first.requiredLetter).toBeUndefined();
    expect(first.turnLine).toBe(playCopy.myTurnFirst);
    expect(first.round).toBe(1);
  });

  it("waits for the other player in a waiting game", () => {
    const waiting = state({ status: "waiting", players: [player("niloofar", 0)], turn: null });
    expect([waiting.isWaiting, waiting.isMyTurn, waiting.other]).toEqual([true, false, undefined]);
    expect(waiting.turnLine).toBe("منتظر دوستت…");
  });

  it("says the time left as hours for a day, minutes, and a clock for short turns", () => {
    const day = state({ moves: [saraMove] });
    const deadline = at("2026-11-25T09:40:00.000Z");
    expect(day.timeLabel(deadline - (21 * 3600 + 600) * 1000)).toBe("۲۱ ساعت");
    expect(day.timeLabel(deadline - 45 * 60 * 1000)).toBe("۴۵ دقیقه");
    expect(day.timeLabel(deadline - 30 * 1000)).toBe("۰:۳۰");
    expect(day.timeLabel(deadline + 60 * 1000)).toBe("۰:۰۰");

    const quick = state({ turnSeconds: 30, turn: { username: "niloofar", deadline: "2026-11-24T09:40:30.000Z" } });
    expect(quick.timeLabel(at("2026-11-24T09:40:05.000Z"))).toBe("۰:۲۵");
    expect(quick.roundLine.endsWith("۳۰ ثانیه")).toBe(true);
  });

  it("has no clock for a finished game, and an outcome", () => {
    const done = { status: "done", turn: null } as const;
    const won = state({ ...done, winner: "niloofar", endReason: "resigned", moves: [saraMove] });
    expect(won.timeLabel(Date.now())).toBeUndefined();
    expect([won.outcome, won.outcomeTitle, won.endLine]).toEqual(["won", "بردی!", "سارا کم آورد"]);
    const lost = state({ ...done, winner: "sara.ghazal", endReason: "timeout" });
    expect([lost.outcomeTitle, lost.endLine]).toEqual(["سارا برد", "وقتت تموم شد"]);
    expect(state({ ...done, winner: "niloofar", endReason: "left" }).endLine).toBe("سارا رفت");
    const draw = state(done);
    expect([draw.outcome, draw.outcomeTitle]).toEqual(["draw", "مساوی"]);
    expect(state({ ...done, winner: "sara.ghazal", endReason: "resigned" }).endLine).toBe("کم آوردی");
  });

  it("titles the card of the games tab", () => {
    expect(state().cardTitle).toBe("سارا اومد توی بازی");
    expect(state({ moves: [saraMove] }).cardTitle).toBe("سارا جوابت رو داد");
  });

  it("is the same for me whichever seat I have", () => {
    const as = new MoshState(game({ players: [niloofar, sara] }), "sara.ghazal");
    expect([as.myScore, as.theirScore]).toEqual([1, 0]);
  });
});

describe("what a refused move says", () => {
  const error = (code: string, status = 409) => new ApiError(status, code);
  it("gives the line of the board", () => {
    expect(playCopy.moveError(error("wrong_letter"), "د")).toBe("با حرف «د» شروع نمی‌شه");
    expect(playCopy.moveError(error("already_played"), "د")).toBe("این بیت رو قبلاً گفتید");
    expect(playCopy.moveError(error("turn_over"), "د")).toBe("وقتت تموم شد");
    expect(playCopy.moveError(error("bad_couplet", 400), "د")).toBe("این بیت با متن گنجور نمی‌خونه");
    expect(playCopy.moveError(error("not_your_turn"))).toBe("نوبت تو نیست");
    expect(playCopy.moveError(error("game_not_active"))).toBe("این بازی تموم شده");
    expect(playCopy.moveError(new ApiError(0))).toBe(new ApiError(0).persianMessage);
    expect(playCopy.wrongLetter()).toBe("با این حرف شروع نمی‌شه");
  });

  it("says what joining or making a game refused", () => {
    expect(playCopy.gameError(error("game_full"))).toBe("یکی دیگه زودتر اومده توی این بازی");
    expect(playCopy.gameError(error("not_found", 404))).toBe("این بازی پیدا نشد");
    expect(playCopy.gameError(error("username_required", 403))).toBe("برای بازی با دوستات یه نام کاربری لازمه");
  });
});
