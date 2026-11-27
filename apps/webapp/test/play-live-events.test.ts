import { describe, expect, it } from "vitest";
import { decodeLive } from "../lib/messages/liveEvents";
import { duelAnswerFrame } from "../lib/play/liveGameEvents";
import { game, saraMove } from "./play";

// The ports of `gameEventsAreDecoded`, `duelEventsAreDecoded` and `theAnswerFrameIsWhatTheServerReads` (PlayCenterTests.swift and MoshStateTests.swift).

const scores = [{ username: "sara.ghazal", score: 2 }, { username: "niloofar", score: 1 }];

describe("the live events of games", () => {
  it("decodes game.started, game.move, game.turn and game.ended", () => {
    expect(decodeLive(JSON.stringify({ type: "game.started", game: game() }))).toMatchObject({ type: "game.started", game: { id: "g1", status: "active", moves: [], rounds: [] } });
    expect(decodeLive(JSON.stringify({ type: "game.move", gameId: "g1", move: saraMove, scores }))).toMatchObject({ type: "game.move", gameId: "g1", move: { n: 1 }, scores });
    expect(decodeLive('{"type":"game.turn","gameId":"g1","username":"niloofar","deadline":"2026-11-25T09:40:00.000Z"}')).toEqual({ type: "game.turn", gameId: "g1", username: "niloofar", deadline: "2026-11-25T09:40:00.000Z" });
    const ended = decodeLive(JSON.stringify({ type: "game.ended", gameId: "g1", winner: "sara.ghazal", reason: "left", scores }));
    expect(ended).toEqual({ type: "game.ended", gameId: "g1", winner: "sara.ghazal", reason: "left", scores, couplets: [] });
  });

  it("decodes the duel's question, answer, round and a challenge's result", () => {
    const asked = decodeLive('{"type":"duel.question","gameId":"g1","round":4,"rounds":5,"kind":"second","couplet":{"m1":"توانا بود هر که دانا بود"},"poet":"فردوسی","options":["الف","ب","ج"],"deadlineMs":8000}');
    expect(asked).toEqual({ type: "duel.question", question: { gameId: "g1", round: 4, rounds: 5, kind: "second", m1: "توانا بود هر که دانا بود", poet: "فردوسی", options: ["الف", "ب", "ج"], deadlineMs: 8000 } });
    expect(decodeLive('{"type":"duel.answered","gameId":"g1","round":4,"username":"sara.ghazal"}')).toEqual({ type: "duel.answered", gameId: "g1", round: 4, username: "sara.ghazal" });
    expect(decodeLive('{"type":"duel.round","gameId":"g1","round":4,"winner":null,"rightOption":2,"scores":[{"username":"niloofar","score":2}]}')).toEqual({
      type: "duel.round",
      gameId: "g1",
      round: 4,
      winner: null,
      rightOption: 2,
      scores: [{ username: "niloofar", score: 2 }],
    });
    expect(decodeLive('{"type":"challenge.result","code":"7KQ2","game":"jigsaw","result":{"name":"کیان","username":null,"score":9,"seconds":80}}')).toEqual({
      type: "challenge.result",
      code: "7KQ2",
      game: "jigsaw",
      result: { name: "کیان", username: null, score: 9, seconds: 80 },
    });
  });

  it("reads a question of the poet game with both hemistichs and no poet", () => {
    const asked = decodeLive('{"type":"duel.question","gameId":"g1","round":5,"rounds":5,"kind":"poet","couplet":{"m1":"الف","m2":"ب"},"poet":null,"options":["مولانا","حافظ","سعدی","فردوسی"],"deadlineMs":8000}');
    expect(asked).toMatchObject({ type: "duel.question", question: { kind: "poet", m2: "ب", options: expect.any(Array) } });
    expect(asked).not.toHaveProperty("question.poet");
  });

  it("takes an event whose fields are not as the contract says for an unknown one", () => {
    expect(decodeLive('{"type":"duel.answered","gameId":"g1","round":"four","username":"sara"}')).toEqual({ type: "other", name: "duel.answered" });
    expect(decodeLive('{"type":"game.ended","gameId":"g1","winner":null,"reason":"exploded","scores":[]}')).toEqual({ type: "other", name: "game.ended" });
    expect(decodeLive('{"type":"game.started","game":{"id":"g1"}}')).toEqual({ type: "other", name: "game.started" });
    expect(decodeLive('{"type":"duel.question","gameId":"g1","round":1,"rounds":5,"kind":"second","couplet":{},"options":[],"deadlineMs":1}')).toEqual({ type: "other", name: "duel.question" });
  });

  it("writes the answer frame the server reads", () => {
    expect(JSON.parse(duelAnswerFrame("g1", 2, 3))).toEqual({ type: "duel.answer", gameId: "g1", round: 2, option: 3 });
  });
});
