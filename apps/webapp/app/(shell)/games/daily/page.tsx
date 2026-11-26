import type { Metadata } from "next";
import { GameCover } from "../../../../components/games/GameCover";

export const metadata: Metadata = { title: "معمای امروز" };

/** معمای امروز opened by its link: the game is just there (a layer of its own, over the page), and closing goes to the games tab. Opened inside the app, `@game` shows it instead. */
export default function DailyPage() {
  return <GameCover kind="daily" modal={false} />;
}
