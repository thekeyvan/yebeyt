import { parsePoet, type PlayableKind } from "../../lib/games/kinds";
import { GameCover } from "./GameCover";

/**
 * One of the quiz games or معنی‌یاب opened from inside the app (`@game/(.)games/<kind>`): it rises over the page it came from, which stays under it, and
 * closing goes back to it. Each game has its own intercepting route: one for every `/games/<name>` would also catch the pages that are not games
 * (`/games/catalog`) and keep them from opening.
 */
export async function GameOverPage({ kind, searchParams }: { kind: PlayableKind; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <GameCover kind={kind} modal poet={kind === "misra" ? parsePoet((await searchParams).poet) : undefined} />;
}
