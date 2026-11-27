import type { Metadata } from "next";
import { SharedDivanScreen } from "../../../../../components/messages/SharedDivanScreen";

export const metadata: Metadata = { title: "دیوان مشترک" };

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  return <SharedDivanScreen username={(await params).username} />;
}
