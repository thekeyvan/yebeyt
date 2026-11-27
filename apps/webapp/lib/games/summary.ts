import { persianClock, persianDigits } from "../persian";
import { offerOf, type ChallengeOffer } from "../play/challengeOffer";
import { singlePoet, type GameCouplet } from "./couplet";
import type { JigsawRound } from "./jigsawRound";
import { nameOf } from "./kinds";
import type { MatchRound } from "./matchRound";
import type { QuizRound } from "./quizRound";

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
  /** The amber «+۳۲۰ امتیاز» sticker; a game with a friend gives league points, not these. Shown unless false. */
  showsPoints?: boolean;
  /** A line with the meaning under each couplet (رودررو). */
  showsMeanings?: boolean;
  /** What a challenge made from this round is, when the round can be one: a signed-in person sees its card instead of the couplets. */
  offer?: ChallengeOffer;
  /** How long جورچین or حدس شاعر took: what a result on a challenge says. */
  seconds?: number;
  /** A game against someone: whether I won it. Undefined for a solo round. */
  won?: boolean;
};

/** Worth a burst: a game won, or a solo round with at least half right. */
export const celebrates = (summary: Pick<RoundSummary, "right" | "total" | "won">): boolean => summary.won ?? summary.right * 2 >= summary.total;

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
    offer: offerOf("jigsaw", couplets, round.rightCount, round.elapsed),
    seconds: round.elapsed,
  };
}

export function quizSummary(round: QuizRound): RoundSummary {
  const parts = [nameOf(round.kind), countText(round.questions.map((question) => question.couplet), "سؤال")];
  if (round.clock.kind === "perQuestion") parts.push(persianClock(round.answers.reduce((sum, answer) => sum + answer.seconds, 0)));
  else if (round.clock.kind === "round") parts.push(persianClock(round.clock.seconds - round.roundLeft));
  const results = round.results;
  const seconds = round.answers.reduce((sum, answer) => sum + answer.seconds, 0);
  return {
    points: round.points,
    right: round.rightCount,
    total: round.questions.length,
    subtitle: parts.join(" · "),
    rows: round.questions.map(({ couplet }, index) => ({ couplet, result: index < results.length ? results[index]! : null })),
    title: "تموم شد!",
    ...(round.kind === "poet" && { offer: offerOf("poet", round.questions.map((question) => question.couplet), round.rightCount, seconds), seconds }),
  };
}

export function matchSummary(round: MatchRound): RoundSummary {
  const done = round.results.length;
  return {
    points: round.points,
    right: done,
    total: round.questions.length,
    subtitle: `${nameOf("match")} · ${persianDigits(round.pairs)} جفت`,
    rows: round.questions.map(({ couplet }, index) => ({ couplet, result: index < done ? true : null })),
    title: "تموم شد!",
  };
}
