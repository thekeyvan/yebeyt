import type { Metadata } from "next";
import { LeaderboardScreen } from "../../../../components/friends/LeaderboardScreen";
import { boardTabs, type BoardTab } from "../../../../lib/friends/leaderboard";

export const metadata: Metadata = { title: "رده‌بندی" };

/** `?tab=league|friends|global` is the tab it starts on (the phone's `-beytBoard`). */
export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { tab } = await searchParams;
  const asked = Array.isArray(tab) ? tab[0] : tab;
  return <LeaderboardScreen tab={boardTabs.find((one) => one.value === asked)?.value ?? ("league" satisfies BoardTab)} />;
}
