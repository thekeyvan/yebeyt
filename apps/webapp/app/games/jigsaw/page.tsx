import type { Metadata } from "next";
import { GameCover } from "../../../components/games/GameCover";

export const metadata: Metadata = { title: "جورچین بیت" };

/** جورچین opened by its link: just there, and closing goes to the games tab. */
export default function JigsawPage() {
  return <GameCover kind="jigsaw" modal={false} />;
}
