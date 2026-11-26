import { daysLeftText, leagueName } from "../../lib/friends/leaderboardLayout";

/** A lapis shield with two small bars, tilted. */
const Shield = () => (
  <svg aria-hidden viewBox="0 0 48 54" className="h-[54px] w-12 shrink-0 -rotate-[8deg] drop-shadow-[0_3px_4px_rgba(20,17,43,0.25)]">
    <path d="M12 2H36A10 10 0 0 1 46 12V30A22 22 0 0 1 24 52A22 22 0 0 1 2 30V12A10 10 0 0 1 12 2Z" fill="var(--color-lapis)" stroke="white" strokeWidth="4" />
    <rect x="15" y="12" width="8" height="15" rx="3" fill="white" />
    <rect x="25" y="12" width="8" height="15" rx="3" fill="var(--color-fire)" />
  </svg>
);

/** The amber card: the shield, «لیگ غزل‌باز» and «۳ روز مونده تا آخر هفته» (Friends/Leaderboard/LeaderboardScreen.swift `LeagueCard`). */
export function LeagueCard({ tier, endsAt, now }: { tier: number; endsAt: string; now: Date }) {
  const end = new Date(endsAt);
  return (
    <div className="flex items-center gap-3 rounded-3xl border-[5px] border-white bg-amber px-[9px] py-[7px] shadow-card">
      <Shield />
      <div className="flex flex-col">
        <p data-testid="league-name" className="font-title text-2xl leading-[1.2] text-ink">
          {leagueName(tier)}
        </p>
        {!Number.isNaN(end.getTime()) && (
          <p data-testid="days-left" className="text-[13px] font-medium text-ink">
            {daysLeftText(end, now)}
          </p>
        )}
      </div>
    </div>
  );
}
