import type { Metadata } from "next";
import { GameCover } from "../../../../../components/games/GameCover";
import { parseStart } from "../../../../../lib/games/jigsawStart";
import { parseInvite } from "../../../../../lib/play/routes";

export const metadata: Metadata = { title: "جورچین بیت" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** جورچین opened from inside the app: it rises over the page it came from, which stays under it, and closing goes back to it. `?invite=<usernames>` is the friends a challenge made from the round goes to. */
export default async function JigsawOverPage({ searchParams }: Props) {
  const query = await searchParams;
  return <GameCover kind="jigsaw" modal start={parseStart(query)} invite={parseInvite(query.invite)} />;
}
