import { persianDigits } from "../persian";
import { tierName } from "../me/badges";
import type { FriendsStandings, GlobalStandings, LeaderboardRow, LeagueStandings, PersonShort } from "./models";

export type Medal = "gold" | "silver" | "bronze";

/** What a row of the leaderboard shows, worked out from the server's row (Friends/Leaderboard/LeaderboardLayout.swift). */
export type LeaderboardEntry = {
  rank: number;
  /** «تو» for my own row, «یه نفر» for a hidden stranger, else the name. */
  name: string;
  username: string | null;
  avatar: PersonShort["avatar"];
  /** A hidden stranger has no face: the row draws a plain circle. */
  isHidden: boolean;
  isMe: boolean;
  points: string;
  medal?: Medal;
  rankText: string;
  /** Someone whose page can be opened: not me, not hidden, with a username. */
  opens?: string;
};

const medals: Partial<Record<number, Medal>> = { 1: "gold", 2: "silver", 3: "bronze" };

export function entryOf(row: LeaderboardRow): LeaderboardEntry {
  const username = row.hidden ? null : row.username;
  return {
    rank: row.rank,
    isMe: row.isMe,
    isHidden: row.hidden,
    username,
    avatar: row.hidden ? null : row.avatar,
    name: row.isMe ? "تو" : row.hidden ? "یه نفر" : (row.displayName ?? row.username ?? "یه نفر"),
    points: persianDigits(row.points, { grouped: true }),
    medal: medals[row.rank],
    rankText: persianDigits(row.rank),
    opens: row.isMe || row.hidden || username === null ? undefined : username,
  };
}

/** A line of the list: a row, the green «این ۵ نفر می‌رن لیگ بالاتر» band between the ranks that move up and the rest, or a «…» for the ranks left out between the list and my own row. */
export type LeaderboardItem = { kind: "entry"; id: string; entry: LeaderboardEntry } | { kind: "promoteBand"; id: "band"; count: number } | { kind: "gap"; id: "gap" };

const rowItem = (row: LeaderboardRow): LeaderboardItem => ({ kind: "entry", id: `row-${row.rank}`, entry: entryOf(row) });

/** The league's rows, with the band after the first `promoteCount` (not drawn when nobody is below them). */
export function leagueItems(standings: LeagueStandings): LeaderboardItem[] {
  return standings.rows.flatMap((row, index): LeaderboardItem[] =>
    index === standings.promoteCount && standings.promoteCount > 0 ? [{ kind: "promoteBand", id: "band", count: standings.promoteCount }, rowItem(row)] : [rowItem(row)],
  );
}

export const friendsItems = (standings: FriendsStandings): LeaderboardItem[] => standings.rows.map(rowItem);

/** The friends tab has nothing to show but me when I have no friends yet. */
export const hasNoFriends = (standings: FriendsStandings): boolean => standings.rows.every((row) => row.isMe);

/**
 * The global list. When I keep off it (`inGlobal` is false) only my own row is shown (when I have a rank). When my rank is further down than the rows loaded, my
 * row comes last, after a «…».
 */
export function globalItems(standings: GlobalStandings, inGlobal: boolean): LeaderboardItem[] {
  if (!inGlobal) return standings.me ? [rowItem(standings.me)] : [];
  const items = standings.rows.map(rowItem);
  const { me } = standings;
  if (me && !standings.rows.some((row) => row.isMe)) {
    const last = standings.rows.at(-1);
    if (last && me.rank > last.rank + 1) items.push({ kind: "gap", id: "gap" });
    items.push(rowItem(me));
  }
  return items;
}

/** «۳ روز مونده تا آخر هفته»: whole days left, a started day counts; never less than one. */
export const daysLeft = (end: Date, now: Date): number => Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));

export const daysLeftText = (end: Date, now: Date): string => `${persianDigits(daysLeft(end, now))} روز مونده تا آخر هفته`;

/** «لیگ غزل‌باز»: the tiers are the levels' names. */
export const leagueName = (tier: number): string => `لیگ ${tierName(tier)}`;
