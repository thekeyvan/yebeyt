"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGameStats } from "../../lib/games/browser";
import type { GameDeck } from "../../lib/games/couplet";
import { pickPuzzle } from "../../lib/games/dailyPuzzle";
import { tabCards } from "../../lib/games/kinds";
import { persianDigits } from "../../lib/persian";
import { useAccount } from "../account/AccountProvider";
import { useMyStats } from "../account/useMyStats";
import { Screen } from "../shell/Screen";
import { Badge } from "../ui/Badge";
import { DailyPuzzleCard } from "./DailyPuzzleCard";
import { GameCard } from "./GameCard";
import { WithDeck } from "./WithDeck";

/** The بازی tab (GamesE): the streak and points (the points open رده‌بندی, which needs an account), today's puzzle and the games with «+ بازی با دوست» (Games/GamesView.swift). */
export function GamesScreen() {
  return <WithDeck wrap={(placeholder) => <Screen>{placeholder}</Screen>}>{(deck) => <Games deck={deck} />}</WithDeck>;
}

function Games({ deck }: { deck: GameDeck }) {
  const stats = useGameStats();
  const account = useAccount();
  const router = useRouter();
  const mine = useMyStats();
  const puzzle = pickPuzzle(stats.today, deck);
  const solved = (stats.daily(stats.today)?.outcome ?? "playing") !== "playing";
  return (
    <Screen>
      <div className="flex flex-col gap-4">
        <div className="flex items-end">
          <h1 className="flex-1 text-[40px] leading-[1.3] text-ink">بازی</h1>
          <div className="flex items-center gap-1.5 pb-1.5">
            <span aria-label={`رشته‌ی ${persianDigits(mine.streak)} روزه`} data-testid="streak">
              <Badge kind="streak" value={mine.streak} />
            </span>
            <button type="button" aria-label={`امتیاز ${persianDigits(mine.points, { grouped: true })} و رده‌بندی`} data-testid="points" onClick={() => account.require("leaderboard", () => router.push("/games/leaderboard"))}>
              <Badge kind="points" value={mine.points} />
            </button>
          </div>
        </div>
        {puzzle && <DailyPuzzleCard puzzle={puzzle} day={stats.today} finished={solved} />}
        <div className="flex items-center gap-3 pt-1.5">
          <h2 className="flex-1 text-2xl leading-[1.3] text-ink">بازی‌ها</h2>
          <button type="button" onClick={() => account.require("games")} data-testid="new-friend-game" className="rounded-full bg-lapis px-3 py-1.5 text-[13px] font-bold leading-[1.4] text-white shadow-[0_2px_4px_rgba(47,53,245,0.25)]">
            + بازی با دوست
          </button>
          <Link href="/games/catalog" data-testid="all-games" className="text-sm font-medium text-lapis">
            همه‌ی بازی‌ها
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-6 pt-2">
          {tabCards.map((kind) => (
            <GameCard key={kind} kind={kind} />
          ))}
        </div>
      </div>
    </Screen>
  );
}
