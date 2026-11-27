import type { ChallengeGame, ChallengeLiveResult, DuelKind, DuelResult, EndReason, FriendGame, GameScore, MoshMove } from "./models";
import { gameOf } from "./models";

/** A question of رودررو: the first hemistich (the second too, except for مصراع دوم), the poet's name when the options don't tell it, and four or three options. `deadlineMs` is the time left in the round at the moment it was sent. */
export type DuelQuestion = { gameId: string; round: number; rounds: number; kind: DuelKind; m1: string; m2?: string; poet?: string; options: string[]; deadlineMs: number };

/** The events of games and challenges (`game.*`, `duel.*`, `challenge.result`) (Play/LiveGameEvents.swift). */
export type GameEvent =
  | { type: "game.started"; game: FriendGame }
  | { type: "game.move"; gameId: string; move: MoshMove; scores: GameScore[] }
  | { type: "game.turn"; gameId: string; username: string; deadline: string }
  | { type: "game.ended"; gameId: string; winner: string | null; reason: EndReason; scores: GameScore[]; couplets: DuelResult[] }
  | { type: "duel.question"; question: DuelQuestion }
  | { type: "duel.answered"; gameId: string; round: number; username: string }
  | { type: "duel.round"; gameId: string; round: number; winner: string | null; rightOption: number; scores: GameScore[] }
  | { type: "challenge.result"; code: string; game: ChallengeGame; result: ChallengeLiveResult };

type Frame = Record<string, unknown>;

const isText = (value: unknown): value is string => typeof value === "string";
const isInt = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);
const isObject = (value: unknown): value is Frame => typeof value === "object" && value !== null && !Array.isArray(value);
const isList = (value: unknown): value is unknown[] => Array.isArray(value);
const orNull = (value: unknown): string | null | undefined => (value === null || value === undefined ? null : isText(value) ? value : undefined);

const kinds: readonly string[] = ["second", "poet", "book"];
const reasons: readonly string[] = ["timeout", "resigned", "left", "finished", "expired"];

const isScore = (value: unknown): value is GameScore => isObject(value) && isText(value.username) && isInt(value.score);
const isMove = (value: unknown): value is MoshMove => isObject(value) && isInt(value.n) && isText(value.key) && isText(value.m1) && isText(value.m2) && isText(value.createdAt);
const isResult = (value: unknown): value is DuelResult =>
  isObject(value) && isInt(value.round) && isText(value.type) && kinds.includes(value.type) && isText(value.key) && isText(value.m1) && isText(value.m2) && isText(value.meaning) && isText(value.poet) && isText(value.bookTitle);
const isPlayer = (value: unknown): boolean => isObject(value) && isText(value.username) && isInt(value.seat) && isInt(value.score);
const scoresOf = (value: unknown): GameScore[] | undefined => (isList(value) && value.every(isScore) ? value : undefined);

/** A game as the server writes it, or undefined when it is not one. */
export function decodeGame(value: unknown): FriendGame | undefined {
  if (!isObject(value) || !isText(value.id) || !["mosh", "duel"].includes(String(value.kind)) || !isInt(value.turnSeconds) || !["waiting", "active", "done"].includes(String(value.status))) return undefined;
  if (!isText(value.code) || !isText(value.createdAt) || !isList(value.players) || !value.players.every(isPlayer)) return undefined;
  const moves = value.moves ?? [];
  const rounds = value.rounds ?? [];
  if (!isList(moves) || !moves.every(isMove) || !isList(rounds) || !rounds.every(isResult)) return undefined;
  return gameOf(value as Parameters<typeof gameOf>[0]);
}

/** The event of a frame of `type`; undefined when it is another event or the fields are not as the contract says. */
export function decodeGameEvent(type: string, frame: Frame): GameEvent | undefined {
  const { gameId } = frame;
  switch (type) {
    case "game.started": {
      const game = decodeGame(frame.game);
      return game && { type, game };
    }
    case "game.move": {
      const scores = scoresOf(frame.scores);
      return isText(gameId) && isMove(frame.move) && scores ? { type, gameId, move: frame.move, scores } : undefined;
    }
    case "game.turn":
      return isText(gameId) && isText(frame.username) && isText(frame.deadline) ? { type, gameId, username: frame.username, deadline: frame.deadline } : undefined;
    case "game.ended": {
      const scores = scoresOf(frame.scores);
      const winner = orNull(frame.winner);
      const couplets = frame.couplets ?? [];
      if (!isText(gameId) || winner === undefined || !isText(frame.reason) || !reasons.includes(frame.reason) || !scores || !isList(couplets) || !couplets.every(isResult)) return undefined;
      return { type, gameId, winner, reason: frame.reason as EndReason, scores, couplets };
    }
    case "duel.question": {
      const { couplet } = frame;
      const poet = orNull(frame.poet);
      if (!isText(gameId) || !isInt(frame.round) || !isInt(frame.rounds) || !isText(frame.kind) || !kinds.includes(frame.kind) || !isObject(couplet) || !isText(couplet.m1)) return undefined;
      if (poet === undefined || !isList(frame.options) || !frame.options.every(isText) || !isInt(frame.deadlineMs) || (couplet.m2 !== undefined && couplet.m2 !== null && !isText(couplet.m2))) return undefined;
      const question: DuelQuestion = { gameId, round: frame.round, rounds: frame.rounds, kind: frame.kind as DuelKind, m1: couplet.m1, options: frame.options, deadlineMs: frame.deadlineMs };
      if (isText(couplet.m2)) question.m2 = couplet.m2;
      if (poet !== null) question.poet = poet;
      return { type, question };
    }
    case "duel.answered":
      return isText(gameId) && isInt(frame.round) && isText(frame.username) ? { type, gameId, round: frame.round, username: frame.username } : undefined;
    case "duel.round": {
      const scores = scoresOf(frame.scores);
      const winner = orNull(frame.winner);
      return isText(gameId) && isInt(frame.round) && winner !== undefined && isInt(frame.rightOption) && scores ? { type, gameId, round: frame.round, winner, rightOption: frame.rightOption, scores } : undefined;
    }
    case "challenge.result": {
      const { result } = frame;
      const username = isObject(result) ? orNull(result.username) : undefined;
      if (!isText(frame.code) || !isText(frame.game) || !["jigsaw", "poet"].includes(frame.game) || !isObject(result) || !isText(result.name) || username === undefined || !isInt(result.score) || !isInt(result.seconds)) return undefined;
      return { type, code: frame.code, game: frame.game as ChallengeGame, result: { name: result.name, username, score: result.score, seconds: result.seconds } };
    }
    default:
      return undefined;
  }
}

/** The frame a player's answer is sent as: `{"type":"duel.answer","gameId":…,"round":…,"option":…}`. */
export const duelAnswerFrame = (gameId: string, round: number, option: number): string => JSON.stringify({ type: "duel.answer", gameId, round, option });
