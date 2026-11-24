import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LinkPage } from "../../../components/LinkPage";
import { getChallenge } from "../../../lib/api";
import { challengeView } from "../../../lib/links";
import { linkMetadata, missingMetadata } from "../../../lib/pageMeta";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const challenge = await getChallenge(code);
  return challenge ? linkMetadata(challengeView(challenge, code)) : missingMetadata("این چالش پیدا نشد");
}

export default async function ChallengePage({ params }: Props) {
  const { code } = await params;
  const challenge = await getChallenge(code);
  if (!challenge) notFound();
  return <LinkPage view={challengeView(challenge, code)} />;
}
