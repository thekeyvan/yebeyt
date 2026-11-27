import { LobbyPage } from "../../../../../components/play/FriendLayers";

/** «بازی با دوست» opened from inside the app: it rises over the page it came from, and closing goes back to it. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <LobbyPage modal query={await searchParams} />;
}
