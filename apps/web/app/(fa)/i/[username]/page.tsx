import type { Metadata } from "next";
import { LinkPage } from "../../../../components/LinkPage";
import { Missing, Unavailable } from "../../../../components/Missing";
import { getPublicUser } from "../../../../lib/api";
import { inviteView } from "../../../../lib/links";
import { lookup } from "../../../../lib/lookup";
import { lookupMetadata } from "../../../../lib/pageMeta";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return lookupMetadata(await lookup(() => getPublicUser(username)), inviteView, "این دعوت پیدا نشد");
}

export default async function InvitePage({ params }: Props) {
  const { username } = await params;
  const found = await lookup(() => getPublicUser(username));
  if (found.status === "found") return <LinkPage view={inviteView(found.data)} />;
  if (found.status === "unavailable") return <Unavailable />;
  return <Missing title="این دعوت پیدا نشد" hint="ممکنه لینک اشتباه باشه یا اون نام کاربری دیگه وجود نداشته باشه." />;
}
