import type { Metadata } from "next";
import { LinkPage } from "../../../../components/LinkPage";
import { Missing, Unavailable } from "../../../../components/Missing";
import { getPublicGame } from "../../../../lib/api";
import { gameView } from "../../../../lib/links";
import { lookup } from "../../../../lib/lookup";
import { lookupMetadata } from "../../../../lib/pageMeta";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return lookupMetadata(await lookup(() => getPublicGame(code)), (g) => gameView(g, code), "این بازی پیدا نشد");
}

export default async function GamePage({ params }: Props) {
  const { code } = await params;
  const found = await lookup(() => getPublicGame(code));
  if (found.status === "found") return <LinkPage view={gameView(found.data, code)} />;
  if (found.status === "unavailable") return <Unavailable />;
  return <Missing title="این بازی پیدا نشد" hint="ممکنه لینک اشتباه باشه یا بازی شروع شده یا تموم شده باشه." />;
}
