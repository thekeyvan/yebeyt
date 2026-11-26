import type { Metadata } from "next";
import { GameCover } from "../../../../../components/games/GameCover";
import { parseStart } from "../../../../../lib/games/jigsawStart";

export const metadata: Metadata = { title: "جورچین بیت" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** جورچین opened from inside the app: it rises over the page it came from, which stays under it, and closing goes back to it. */
export default async function JigsawOverPage({ searchParams }: Props) {
  return <GameCover kind="jigsaw" modal start={parseStart(await searchParams)} />;
}
