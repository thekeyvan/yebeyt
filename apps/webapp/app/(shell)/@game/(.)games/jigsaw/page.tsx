import type { Metadata } from "next";
import { GameCover } from "../../../../../components/games/GameCover";

export const metadata: Metadata = { title: "جورچین بیت" };

/** جورچین opened from inside the app: it rises over the page it came from, which stays under it, and closing goes back to it. */
export default function JigsawOverPage() {
  return <GameCover kind="jigsaw" modal />;
}
