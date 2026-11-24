import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LinkPage } from "../../../components/LinkPage";
import { getPublicUser } from "../../../lib/api";
import { inviteView } from "../../../lib/links";
import { linkMetadata, missingMetadata } from "../../../lib/pageMeta";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const person = await getPublicUser(username);
  return person ? linkMetadata(inviteView(person)) : missingMetadata("این دعوت پیدا نشد");
}

export default async function InvitePage({ params }: Props) {
  const { username } = await params;
  const person = await getPublicUser(username);
  if (!person) notFound();
  return <LinkPage view={inviteView(person)} />;
}
