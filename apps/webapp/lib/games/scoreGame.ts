import type { GameKind } from "./kinds";

/** The games whose rounds are reported to the server (`game` of `ScoreRequest`; Games/ScoreGame.swift). */
export type ScoreGame = "daily" | "jigsaw" | "poet" | "second" | "book" | "match" | "listen" | "onboarding";

/** The most points one round can score there: معمای امروز 100, جورچین 20 × 10 + 120, the quiz games 10 × 44, معنی‌یاب 50, گوش کن 100, the onboarding game 50. The caps are the server's (`GAME_CAPS`); a round above its cap is refused, so it is clipped before sending. */
const caps: Record<ScoreGame, number> = { daily: 100, jigsaw: 20 * 10 + 120, poet: 10 * 44, second: 10 * 44, book: 10 * 44, match: 50, listen: 100, onboarding: 50 };

export const capOf = (game: ScoreGame): number => caps[game];

export const clipped = (game: ScoreGame, points: number): number => Math.min(Math.max(0, points), caps[game]);

/** undefined for the games with friends: the server records those itself. */
export function scoreGameOf(kind: GameKind): ScoreGame | undefined {
  if (kind === "mosh" || kind === "duel") return undefined;
  return kind === "misra" ? "second" : kind;
}
