import type { components } from "../api/schema";

// The games-with-friends part of the contract (`packages/api/openapi.json`): games, their players, couplets and rounds, and challenges (Play/FriendGame.swift).
type Schemas = components["schemas"];

export type GamePlayer = Schemas["GamePlayer"];
/** `MoshMove`: one couplet played in مشاعره. */
export type MoshMove = Schemas["MoshMove"];
/** `DuelRoundResult`: a round of a finished رودررو, with the couplet and its meaning. `poet` is the poet's slug. */
export type DuelResult = Schemas["DuelRoundResult"];
/** The three kinds of question in رودررو: مصراع دوم, حدس شاعر, از کدوم کتاب؟ */
export type DuelKind = DuelResult["type"];
export type GameKind = Schemas["GameSummary"]["kind"];
export type GameStatus = Schemas["GameSummary"]["status"];
export type EndReason = NonNullable<Schemas["GameSummary"]["endReason"]>;
/** `Game` (and `GameSummary`, which has no moves or rounds: they are empty here). */
export type FriendGame = Omit<Schemas["GameSummary"], "turn"> & { turn: NonNullable<Schemas["GameSummary"]["turn"]> | null; moves: MoshMove[]; rounds: DuelResult[] };
export type GameCreated = Omit<Schemas["GameCreated"], "game"> & { game: FriendGame };
export type GameScore = { username: string; score: number };

/** The two games that are challenges: the same ten couplets for each player. */
export type ChallengeGame = Schemas["Challenge"]["game"];
export type Challenge = Schemas["Challenge"];
export type ChallengeCreated = Schemas["ChallengeCreated"];
/** The result inside a live `challenge.result` event. */
export type ChallengeLiveResult = { name: string; username: string | null; score: number; seconds: number };

/** The game as the page keeps it, from what the server says (a list's games have no couplets or rounds). */
export function gameOf(wire: Schemas["GameSummary"] & { moves?: MoshMove[]; rounds?: DuelResult[] }): FriendGame {
  return { ...wire, turn: wire.turn ?? null, moves: wire.moves ?? [], rounds: wire.rounds ?? [] };
}

/** The name shown: the display name, else the username. */
export const playerName = (player: Pick<GamePlayer, "username" | "displayName">): string => (player.displayName?.trim() ? player.displayName : player.username);

export const playerOf = (game: FriendGame, username: string): GamePlayer | undefined => game.players.find((player) => player.username === username);

/** The other player, undefined while nobody has joined. */
export const otherThan = (game: FriendGame, username: string): GamePlayer | undefined => game.players.find((player) => player.username !== username);
