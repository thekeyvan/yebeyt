import type { Metadata } from "next";
import { DuelPage } from "../../../../../components/play/FriendLayers";

export const metadata: Metadata = { title: "بازی رودررو" };

/** A game with a friend opened by its link (the id the server made): the game is just there, and closing goes to the games tab. Opened inside the app, `@game` shows it instead. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <DuelPage modal={false} id={(await params).id} />;
}
