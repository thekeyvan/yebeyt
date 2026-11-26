/** Leaving a solo game before its round is over (Games/LeaveGame.swift). The question is only for a round that has started; the words are the lead's (docs/yebeyt-2.md, «Asking before it hurts»). */
export const leaveGame = {
  title: "از بازی بری بیرون؟",
  message: "نتیجه‌ی این دور ثبت نمی‌شه.",
  leave: "برو بیرون",
  stay: "بمون",
  /** The round has started when an answer is given or its clock runs; a round whose result screen shows has nothing left to lose. */
  asks: ({ answered, clockRuns, finished }: { answered: number; clockRuns: boolean; finished: boolean }): boolean => !finished && (answered > 0 || clockRuns),
} as const;
