import type { components } from "../api/schema";
import type { GameKind } from "./kinds";

/** The games whose rounds the browser reports to the server (`game` of `ScoreRequest`). */
export type ScoreGame = components["schemas"]["ScoreRequest"]["game"];

/**
 * The most points one round can score there (Games/ScoreGame.swift): the server's (`GAME_CAPS` in apps/server/src/scores.ts); a round above its cap is
 * refused, so it is clipped before sending. معمای امروز 100, جورچین 20 × 10 + 120, the quiz games 10 × 44, معنی‌یاب 50, گوش کن 100, the onboarding game 50.
 */
export const scoreCaps: Record<ScoreGame, number> = { daily: 100, jigsaw: 20 * 10 + 120, poet: 440, second: 440, book: 440, match: 50, listen: 100, onboarding: 50 };

/** undefined for the games with friends: the server records those itself. */
export function scoreGameOf(kind: GameKind): ScoreGame | undefined {
  switch (kind) {
    case "misra":
      return "second";
    case "mosh":
    case "duel":
      return undefined;
    default:
      return kind;
  }
}

export const clipped = (game: ScoreGame, points: number): number => Math.min(Math.max(0, points), scoreCaps[game]);
