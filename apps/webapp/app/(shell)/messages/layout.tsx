import type { ReactNode } from "react";
import { MessagesLayout } from "../../../components/messages/MessagesLayout";

export default function Layout({ children }: { children: ReactNode }) {
  return <MessagesLayout>{children}</MessagesLayout>;
}
