import type { Metadata } from "next";
import { ChatScreen } from "../../../../components/messages/ChatScreen";

export const metadata: Metadata = { title: "پیام‌ها" };

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  return <ChatScreen username={(await params).username} />;
}
