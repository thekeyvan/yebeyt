import type { Call } from "../account/api";
import type { components } from "../api/schema";
import { gameOf, type Challenge, type ChallengeCreated, type ChallengeGame, type FriendGame, type GameCreated, type GameKind } from "./models";

type Schemas = components["schemas"];

const at = (id: string): string => encodeURIComponent(id);

/** The calls of games with friends and challenges (Play/GamesAPI.swift), through the web app's door. */
export function playApi(call: Call) {
  return {
    /** Makes a game that waits for a second player and sends the invitations. مشاعره needs `turnSeconds` (30, 120 or 86400); رودررو leaves it out. */
    async createGame(kind: GameKind, turnSeconds: number | undefined, invite: readonly string[]): Promise<GameCreated> {
      const made = await call<Schemas["GameCreated"]>("POST", "/v1/games", { body: { kind, ...(turnSeconds === undefined ? {} : { turnSeconds }), invite } });
      return { ...made, game: gameOf(made.game) };
    },
    /** Takes the free seat of a waiting game, by its id (always by id from an invitation, never by an old code). */
    async joinGame(id: string): Promise<FriendGame> {
      return gameOf(await call<Schemas["Game"]>("POST", `/v1/games/${at(id)}/join`));
    },
    async game(id: string): Promise<FriendGame> {
      return gameOf(await call<Schemas["Game"]>("GET", `/v1/games/${at(id)}`));
    },
    /** Waiting and active games and the ones that ended in the last week, newest first, without couplets or rounds. */
    async myGames(): Promise<FriendGame[]> {
      return (await call<Schemas["GameList"]>("GET", "/v1/me/games")).items.map(gameOf);
    },
    async playMove(gameId: string, key: string, m1: string, m2: string): Promise<FriendGame> {
      return gameOf(await call<Schemas["Game"]>("POST", `/v1/games/${at(gameId)}/moves`, { body: { key, m1, m2 } }));
    },
    /** «کم آوردم». */
    async resign(gameId: string): Promise<FriendGame> {
      return gameOf(await call<Schemas["Game"]>("POST", `/v1/games/${at(gameId)}/resign`));
    },
    createChallenge: (game: ChallengeGame, items: readonly string[], score: number, seconds: number) => call<ChallengeCreated>("POST", "/v1/challenges", { body: { game, items, score, seconds } }),
    /** No account needed. */
    challenge: (code: string) => call<Challenge>("GET", `/v1/challenges/${at(code)}`),
    /** Leaves a result. Without an account (no session cookie) the `name` is required. */
    postChallengeResult: (code: string, score: number, seconds: number, name?: string) =>
      call<{ id: string }>("POST", `/v1/challenges/${at(code)}/results`, { body: { score, seconds, ...(name === undefined ? {} : { name }) } }).then((): void => {}),
  };
}
