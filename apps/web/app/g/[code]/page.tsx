import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LinkPage } from "../../../components/LinkPage";
import { getPublicGame } from "../../../lib/api";
import { gameView } from "../../../lib/links";
import { linkMetadata, missingMetadata } from "../../../lib/pageMeta";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const game = await getPublicGame(code);
  return game ? linkMetadata(gameView(game, code)) : missingMetadata("این بازی پیدا نشد");
}

export default async function GamePage({ params }: Props) {
  const { code } = await params;
  const game = await getPublicGame(code);
  if (!game) notFound();
  return <LinkPage view={gameView(game, code)} />;
}
