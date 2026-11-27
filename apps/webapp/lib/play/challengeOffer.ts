import { coupletId, singlePoet, type GameCouplet, type GameDeck } from "../games/couplet";
import { persianDigits } from "../persian";
import type { ChallengeGame } from "./models";

export const challengeItemCount = 10;

/** The ten couplets of a finished جورچین or حدس شاعر round, the score and the time: what a challenge is made of (Games/RoundSummary.swift `ChallengeOffer`). */
export type ChallengeOffer = {
  game: ChallengeGame;
  /** The couplet keys, in the order they were played. */
  items: string[];
  score: number;
  seconds: number;
  /** The first couplet, shown on the preview card. */
  first: GameCouplet;
  /** «۱۰ بیت سعدی» when all ten are by one poet. */
  label?: string;
  /** The friends picked in the lobby: the challenge goes to them once it is made. */
  invite: string[];
};

/** The offer of a round of `couplets`; undefined unless there are exactly ten. */
export function offerOf(game: ChallengeGame, couplets: readonly GameCouplet[], score: number, seconds: number, invite: readonly string[] = []): ChallengeOffer | undefined {
  const first = couplets[0];
  if (couplets.length !== challengeItemCount || !first) return undefined;
  const poet = singlePoet(couplets);
  return { game, items: couplets.map(coupletId), score, seconds, first, ...(poet && { label: `${persianDigits(couplets.length)} بیت ${poet}` }), invite: [...invite] };
}

/** The server takes only couplets of the game deck: a round with one from a poem the reader had open is no challenge. */
export const isInDeck = (offer: ChallengeOffer, deck: GameDeck): boolean => offer.items.every((key) => deck.keys.has(key));
