import { persianClock, persianDigits } from "../persian";
import { singlePoet, type GameCouplet } from "./couplet";
import type { JigsawRound } from "./jigsawRound";

/**
 * What the end-of-round screen shows, whatever the game: the points, how many were right, a line about the round and the round's couplets
 * (a null result is a couplet the time ran out before) (Games/RoundSummary.swift).
 */
export type RoundSummary = {
  points: number;
  right: number;
  total: number;
  subtitle: string;
  rows: { couplet: GameCouplet; result: boolean | null }[];
  /** The big word. */
  title: string;
};

/** Worth a burst: a solo round with at least half right. */
export const celebrates = (summary: Pick<RoundSummary, "right" | "total">): boolean => summary.right * 2 >= summary.total;

/** «۱۰ بیت سعدی» */
const countText = (couplets: readonly GameCouplet[], unit: string): string => {
  const poet = singlePoet(couplets);
  return `${persianDigits(couplets.length)} ${unit}${poet ? ` ${poet}` : ""}`;
};

export function jigsawSummary(round: JigsawRound): RoundSummary {
  const couplets = round.questions.map((question) => question.couplet);
  return {
    points: round.totalPoints,
    right: round.rightCount,
    total: round.questions.length,
    subtitle: ["جورچین بیت", countText(couplets, "بیت"), persianClock(round.elapsed)].join(" · "),
    rows: couplets.map((couplet, index) => ({ couplet, result: index < round.answers.length ? round.answers[index]!.result.isRight : null })),
    title: "تموم شد!",
  };
}
