import type { Metadata } from "next";
import { LinkPage } from "../../../../components/LinkPage";
import { Missing, Unavailable } from "../../../../components/Missing";
import { getChallenge } from "../../../../lib/api";
import { challengeView } from "../../../../lib/links";
import { lookup } from "../../../../lib/lookup";
import { lookupMetadata } from "../../../../lib/pageMeta";

type Props = { params: Promise<{ code: string }> };

// The page renders its own «not found» (the framework's notFound() leaves the HTML to the browser to fill in),
// so a person without JavaScript, or a crawler, gets the real page.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return lookupMetadata(await lookup(() => getChallenge(code)), (c) => challengeView(c, code), "این چالش پیدا نشد");
}

export default async function ChallengePage({ params }: Props) {
  const { code } = await params;
  const found = await lookup(() => getChallenge(code));
  if (found.status === "found") return <LinkPage view={challengeView(found.data, code)} />;
  if (found.status === "unavailable") return <Unavailable />;
  return <Missing title="این چالش پیدا نشد" hint="ممکنه لینک اشتباه باشه یا چالش تموم شده باشه. چالش‌ها ۳۰ روز می‌مونن." />;
}
