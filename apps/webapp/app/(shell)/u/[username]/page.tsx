import type { Metadata } from "next";
import { PersonScreen } from "../../../../components/friends/PersonScreen";

export const metadata: Metadata = { title: "یه نفر" };

/** Another person's page; the link of yebeyt.com's `/i/<username>` page opens it. */
export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <PersonScreen username={username} />;
}
