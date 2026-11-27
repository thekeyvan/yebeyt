import { describe, expect, it } from "vitest";
import { DuelState } from "../lib/play/duelState";
import type { DuelQuestion, GameEvent } from "../lib/play/liveGameEvents";
import type { DuelResult } from "../lib/play/models";
import { duelResult } from "./play";

// The port of DuelStateTests (PlayCenterTests.swift): the states of رودررو as the live events tell them.

const start = 1_000_000;
const state = () => new DuelState("d1", "niloofar", "sara.ghazal");

const question = (round: number, { kind = "second", options = 3, deadlineMs = 8000, gameId = "d1" }: { kind?: DuelQuestion["kind"]; options?: number; deadlineMs?: number; gameId?: string } = {}): GameEvent => ({
  type: "duel.question",
  question: { gameId, round, rounds: 5, kind, m1: "توانا بود هر که دانا بود", poet: "فردوسی", options: Array.from({ length: options }, (_, index) => `گزینه ${index}`), deadlineMs },
});

const result = (round: number, winner: string | null, right = 1, scores: [string, number][] = [], gameId = "d1"): GameEvent => ({ type: "duel.round", gameId, round, winner, rightOption: right, scores: scores.map(([username, score]) => ({ username, score })) });
const answered = (round: number, username: string): GameEvent => ({ type: "duel.answered", gameId: "d1", round, username });

describe("DuelState", () => {
  it("has nothing to answer before the first question", () => {
    const duel = state();
    expect([duel.question, duel.round, duel.canAnswer, duel.isEnded]).toEqual([undefined, 0, false, false]);
    expect(duel.segments.map((segment) => segment.kind)).toEqual(["current", "coming", "coming", "coming", "coming"]);
  });

  it("opens the round with a question and counts the clock down", () => {
    const duel = state();
    duel.apply(question(1), start);
    expect([duel.round, duel.canAnswer]).toEqual([1, true]);
    expect(duel.secondsLeft(start)).toBe(8);
    expect(duel.secondsLeft(start + 2400)).toBe(6);
    expect(duel.secondsLeft(start + 20_000)).toBe(0);
  });

  it("takes the time that is left from a question that comes after a reconnect", () => {
    const duel = state();
    duel.apply(question(2, { deadlineMs: 3000 }), start);
    expect(duel.secondsLeft(start)).toBe(3);
  });

  it("keeps my answer and sends it only once", () => {
    const duel = state();
    duel.apply(question(1), start);
    expect([duel.choose(2), duel.chosen, duel.canAnswer]).toEqual([true, 2, false]);
    expect([duel.choose(0), duel.chosen]).toEqual([false, 2]); // one answer for each round
  });

  it("does not choose an option that is not there", () => {
    const duel = state();
    duel.apply(question(1, { options: 3 }), start);
    expect([duel.choose(3), duel.choose(-1), duel.chosen]).toEqual([false, false, undefined]);
  });

  it("locks me out of the round with a wrong answer", () => {
    const duel = state();
    duel.apply(question(1), start);
    duel.choose(0);
    duel.apply(answered(1, "niloofar"), start);
    expect([duel.lockedOut, duel.otherAnswered, duel.canAnswer]).toEqual([true, false, false]);
  });

  it("shows the chip for the other player's wrong answer and leaves me free", () => {
    const duel = state();
    duel.apply(question(1), start);
    duel.apply(answered(1, "sara.ghazal"), start);
    expect([duel.otherAnswered, duel.lockedOut, duel.canAnswer]).toEqual([true, false, true]);
  });

  it("shows the right option when the round has a result, and ends the answering", () => {
    const duel = state();
    duel.apply(question(1), start);
    duel.apply(result(1, "sara.ghazal", 2, [["niloofar", 0], ["sara.ghazal", 1]]), start);
    expect([duel.isRoundOver, duel.rightOption, duel.canAnswer, duel.roundWinner]).toEqual([true, 2, false, "sara.ghazal"]);
    expect([duel.theirScore, duel.myScore]).toEqual([1, 0]);
  });

  it("keeps my answer and lockout when the same round is asked again", () => {
    const duel = state();
    duel.apply(question(2), start);
    duel.choose(1);
    duel.apply(answered(2, "niloofar"), start);
    duel.apply(answered(2, "sara.ghazal"), start);
    duel.apply(question(2, { deadlineMs: 4000 }), start + 4000); // the socket came back: the time left is sent
    expect([duel.chosen, duel.lockedOut, duel.otherAnswered, duel.canAnswer]).toEqual([1, true, true, false]);
    expect(duel.secondsLeft(start + 4000)).toBe(4);
  });

  it("lets a choice that was not sent be taken back", () => {
    const duel = state();
    duel.apply(question(1), start);
    duel.choose(0);
    duel.undoChoice();
    expect([duel.chosen, duel.canAnswer]).toEqual([undefined, true]);
    duel.choose(1);
    duel.apply(answered(1, "niloofar"), start);
    duel.undoChoice(); // a wrong answer the server knows about stays
    expect([duel.chosen, duel.lockedOut]).toEqual([1, true]);
  });

  it("starts the next question fresh", () => {
    const duel = state();
    duel.apply(question(1), start);
    duel.choose(0);
    duel.apply(answered(1, "niloofar"), start);
    duel.apply(result(1, null), start);
    duel.apply(question(2), start);
    expect([duel.round, duel.chosen, duel.lockedOut, duel.otherAnswered, duel.rightOption, duel.canAnswer]).toEqual([2, undefined, false, false, undefined, true]);
  });

  it("shows who won each round on the strip", () => {
    const duel = state();
    duel.apply(result(1, "niloofar"), start);
    duel.apply(result(2, "sara.ghazal"), start);
    duel.apply(result(3, null), start);
    duel.apply(question(4), start);
    expect(duel.segments).toEqual([{ kind: "won", by: "niloofar" }, { kind: "won", by: "sara.ghazal" }, { kind: "nobody" }, { kind: "current" }, { kind: "coming" }]);
  });

  it("ignores the events of another game", () => {
    const duel = state();
    duel.apply(question(1, { gameId: "other" }), start);
    duel.apply(result(1, "niloofar", 0, [], "other"), start);
    expect([duel.question, duel.winners.size]).toEqual([undefined, 0]);
  });

  it("ignores a late «answered» of an earlier round", () => {
    const duel = state();
    duel.apply(question(2), start);
    duel.apply(answered(1, "niloofar"), start);
    expect(duel.lockedOut).toBe(false);
  });
});

describe("the end of a duel", () => {
  const ended = (winner: string | null, reason: "finished" | "left" = "finished", couplets: DuelResult[] = []): GameEvent => ({
    type: "game.ended",
    gameId: "d1",
    winner,
    reason,
    scores: [{ username: "niloofar", score: 3 }, { username: "sara.ghazal", score: 2 }],
    couplets,
  });

  it("has a title for each result", () => {
    const [won, lost, draw, left] = [state(), state(), state(), state()];
    won.apply(ended("niloofar"), start);
    lost.apply(ended("sara.ghazal"), start);
    draw.apply(ended(null), start);
    left.apply(ended("niloofar", "left"), start);
    expect([won, lost, draw, left].map((duel) => duel.endTitle("سارا"))).toEqual(["بردی!", "سارا برد", "مساوی", "سارا رفت"]);
    expect([won.isEnded, won.myScore]).toEqual([true, 3]);
  });

  it("has the couplets with their meanings and who won each", () => {
    const duel = state();
    duel.apply(ended("niloofar", "finished", [duelResult(1, "niloofar"), duelResult(2, "sara.ghazal"), duelResult(3, null)]), start);
    const summary = duel.summary("سارا", () => "حافظ")!;
    expect([summary.title, summary.showsPoints, summary.showsMeanings, summary.won]).toEqual(["بردی!", false, true, true]);
    expect([summary.right, summary.total, summary.subtitle]).toEqual([3, 5, "تو ۳ · سارا ۲"]);
    expect(summary.rows.map((row) => row.result)).toEqual([true, false, null]);
    expect(summary.rows[0]!.couplet).toMatchObject({ meaning: "معنی 1", poetName: "حافظ", poem: "/hafez/ghazal/sh1", index: 0 });
    expect(state().summary("سارا", (slug) => slug)).toBeUndefined(); // not over
  });
});
