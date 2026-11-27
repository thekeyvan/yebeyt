"use client";

import type { RoundSummary } from "../../lib/games/summary";
import { RoundEnd } from "../games/RoundEnd";
import { ChallengeEnd } from "./ChallengeEnd";
import { useRound } from "./RoundContext";

/** The end of a جورچین or حدس شاعر round: the result of a challenge when the round answers one, else the round's own end (the challenge card or the couplets). */
export function GameEnd({ summary }: { summary: RoundSummary }) {
  const { answering } = useRound();
  return answering ? <ChallengeEnd answering={answering} summary={summary} /> : <RoundEnd summary={summary} />;
}
