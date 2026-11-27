import { isUsername } from "../api/proxy";
import { lobbyGames, type LobbyGame } from "./lobbyModel";

type Query = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

/** What opens the lobby by its address: `/games/lobby?game=duel&with=sara.ghazal` (the game chosen first, and from a chat the friend to invite). */
export type LobbyAddress = { game?: LobbyGame; friend?: string };

export function lobbyURL({ game, friend }: LobbyAddress = {}): string {
  const query = new URLSearchParams();
  if (game) query.set("game", game);
  if (friend) query.set("with", friend);
  return query.size > 0 ? `/games/lobby?${query}` : "/games/lobby";
}

/** The lobby an address asks for; anything that is not a game of the lobby or a username is left out. */
export function parseLobby(query: Query): LobbyAddress {
  const game = lobbyGames.find((one) => one === first(query.game));
  const friend = first(query.with);
  return { ...(game && { game }), ...(friend !== undefined && isUsername(friend) && { friend }) };
}

/** مشاعره and رودررو by the game's id. */
export const gameURL = (kind: "mosh" | "duel", id: string): string => `/games/${kind}/${encodeURIComponent(id)}`;

/** The board of a challenge by its code. */
export const challengeURL = (code: string): string => `/c/${code}`;

/** جورچین or حدس شاعر played first for a challenge that goes to these friends afterwards: `/games/jigsaw?invite=sara.ghazal,kian_k`. */
export function challengeRoundURL(game: "jigsaw" | "poet", invite: readonly string[]): string {
  return invite.length > 0 ? `/games/${game}?${new URLSearchParams({ invite: invite.join(",") })}` : `/games/${game}`;
}

/** The friends an address says a challenge goes to: at most five usernames. */
export function parseInvite(value: string | string[] | undefined): string[] {
  return [...new Set((first(value) ?? "").split(",").filter(isUsername))].slice(0, 5);
}

/** Whether an id (of a game) is one the server's address takes. */
export const isGameId = (id: string): boolean => /^[A-Za-z0-9_-]{1,64}$/.test(id);

/** Whether a code (of a challenge) is one the server's address takes. */
export const isChallengeCode = (code: string): boolean => /^[0-9A-Za-z]{4}$/.test(code);
