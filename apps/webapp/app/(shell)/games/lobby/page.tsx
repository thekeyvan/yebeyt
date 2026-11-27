import type { Metadata } from "next";
import { LobbyPage } from "../../../../components/play/FriendLayers";

export const metadata: Metadata = { title: "بازی با دوست" };

/** «بازی با دوست» opened by its link: `?game=mosh|duel|jigsaw|poet&with=<username>` choose the game and the friend. Opened inside the app, `@game` shows it instead. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <LobbyPage modal={false} query={await searchParams} />;
}
