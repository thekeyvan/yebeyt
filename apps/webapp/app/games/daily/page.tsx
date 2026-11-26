import type { Metadata } from "next";
import { GameCover } from "../../../components/games/GameCover";

export const metadata: Metadata = { title: "معمای امروز" };

/** معمای امروز opened by its link: just there, and closing goes to the games tab. */
export default function DailyPage() {
  return <GameCover kind="daily" modal={false} />;
}
