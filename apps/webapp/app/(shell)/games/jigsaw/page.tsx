import type { Metadata } from "next";
import { GameCover } from "../../../../components/games/GameCover";
import { parseStart } from "../../../../lib/games/jigsawStart";
import { parseInvite } from "../../../../lib/play/routes";

export const metadata: Metadata = { title: "جورچین بیت" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** جورچین opened by its link: the game is just there (a layer of its own, over the page), and closing goes to the games tab. `?poem=<path>&c=<n>` starts it with that poem or couplet. Opened inside the app, `@game` shows it instead. */
export default async function JigsawPage({ searchParams }: Props) {
  const query = await searchParams;
  return <GameCover kind="jigsaw" modal={false} start={parseStart(query)} invite={parseInvite(query.invite)} />;
}
