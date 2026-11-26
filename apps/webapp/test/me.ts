import type { DailyRecord } from "../lib/games/letterMarks";

/** A daily puzzle solved with one try. */
export const solved = (): DailyRecord => ({ tries: ["مصام"], hinted: [], outcome: "solved", points: 100 });
