"use client";

import { jigsawURL, type JigsawStart } from "../../lib/games/jigsawStart";
import type { PlayableKind } from "../../lib/games/kinds";
import { DailyScreen } from "./DailyScreen";
import { JigsawScreen } from "./JigsawScreen";
import { MatchScreen } from "./MatchScreen";
import { QuizScreen } from "./QuizScreen";

/** The game a page opens: `start` is where a جورچین round starts, `poet` the one a مصراع دوم round is of. A new start is a new round. */
export function GameScreen({ kind, start, poet }: { kind: PlayableKind; start: JigsawStart; poet?: string }) {
  switch (kind) {
    case "daily":
      return <DailyScreen />;
    case "jigsaw":
      return <JigsawScreen key={jigsawURL(start)} start={start} />;
    case "match":
      return <MatchScreen />;
    default:
      return <QuizScreen key={`${kind} ${poet}`} kind={kind} poet={poet} />;
  }
}
