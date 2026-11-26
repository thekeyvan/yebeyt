import { describe, expect, it } from "vitest";
import { ApiError } from "../lib/account/api";
import { LeaderboardModel } from "../lib/friends/leaderboard";
import { daysLeft, daysLeftText, entryOf, friendsItems, globalItems, hasNoFriends, leagueItems, leagueName, type LeaderboardItem } from "../lib/friends/leaderboardLayout";
import type { LeaderboardRow, LeagueStandings } from "../lib/friends/models";
import { fakeServer, ok, refuse } from "./friends";

// The ports of LeaderboardTests.swift.
const row = (rank: number, name: string | null, points: number, flags: { me?: boolean; hidden?: boolean } = {}): LeaderboardRow => ({
  rank, username: name === null ? null : `u${name}`, displayName: name, avatar: null, points, isMe: flags.me ?? false, hidden: flags.hidden ?? false,
});
const rows = [row(1, "آرین", 2910), row(2, "سارا", 2640), row(3, "تو", 2480, { me: true }), row(4, "کیان", 2310), row(5, "مهسا", 2090), row(6, null, 1950, { hidden: true }), row(7, "پریا", 1720), row(8, "رها", 1610)];
const league = (list: LeaderboardRow[]): LeagueStandings => ({ week: "2026-W47", tier: 2, endsAt: "2026-11-27T20:30:00.000Z", rows: list, promoteCount: 5, demoteCount: 5 });
const entries = (items: LeaderboardItem[]) => items.flatMap((item) => (item.kind === "entry" ? [item.entry] : []));

describe("the layout of the boards (LeaderboardLayoutTests)", () => {
  it("the league has medals for the first three and Persian points", () => {
    const list = entries(leagueItems(league(rows)));
    expect(list.map((one) => one.medal)).toEqual(["gold", "silver", "bronze", undefined, undefined, undefined, undefined, undefined]);
    expect(list[0]!.points).toBe("۲٬۹۱۰");
    expect(list[3]!.rankText).toBe("۴");
  });

  it("my row is called «تو» and flagged, and does not open a page", () => {
    const mine = entries(leagueItems(league(rows))).filter((one) => one.isMe);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ name: "تو", rank: 3, opens: undefined });
  });

  it("the band comes after the fifth row only", () => {
    const items = leagueItems(league(rows));
    expect(items).toHaveLength(9);
    expect(items[5]).toEqual({ kind: "promoteBand", id: "band", count: 5 });
    expect(items[6]).toMatchObject({ kind: "entry", entry: { rank: 6 } });
    // Five people or fewer: nobody is below the band, so it is not drawn.
    expect(leagueItems(league(rows.slice(0, 5))).some((item) => item.kind === "promoteBand")).toBe(false);
  });

  it("a hidden stranger is someone without name or face", () => {
    const one = entryOf({ rank: 6, username: "leak", displayName: "leak", avatar: { face: "peach", eyes: "round", hair: "dark", mouth: "smile", accessory: "none", background: "sun" }, points: 1950, isMe: false, hidden: true });
    expect(one).toMatchObject({ name: "یه نفر", isHidden: true, avatar: null, username: null, opens: undefined, points: "۱٬۹۵۰" });
  });

  it("a row without a display name shows the username", () => {
    expect(entryOf({ ...row(4, null, 5), username: "kian_k" })).toMatchObject({ name: "kian_k", opens: "kian_k" });
  });

  it("friends with no friends has only me", () => {
    expect(hasNoFriends({ week: "w", rows: [row(1, "من", 0, { me: true })] })).toBe(true);
    expect(hasNoFriends({ week: "w", rows: [row(1, "سارا", 9), row(2, "من", 0, { me: true })] })).toBe(false);
    expect(entries(friendsItems({ week: "w", rows }))).toHaveLength(8);
  });

  it("when I keep off the global list only my own row shows", () => {
    const standings = { week: "w", rows: [row(1, "آرین", 900)], me: row(42, "من", 120, { me: true }), nextCursor: null };
    const items = globalItems(standings, false);
    expect(items).toHaveLength(1);
    expect(entries(items)[0]).toMatchObject({ isMe: true, rank: 42 });
    expect(globalItems({ week: "w", rows: [], me: null, nextCursor: null }, false)).toEqual([]);
  });

  it("when I am on the global list my rank is added if it is on another page", () => {
    const far = { week: "w", rows: [row(1, "آرین", 900)], me: row(80, "من", 120, { me: true }), nextCursor: "c" };
    expect(globalItems(far, true).map((item) => item.id)).toEqual(["row-1", "gap", "row-80"]);
    const onPage = { week: "w", rows: [row(1, "من", 900, { me: true })], me: row(1, "من", 900, { me: true }), nextCursor: null };
    expect(globalItems(onPage, true)).toHaveLength(1);
  });

  it("my row far down the list comes last after a gap, and next to the list it needs none", () => {
    const r = (rank: number, me = false) => row(rank, `u${rank}`, 10, { me });
    expect(globalItems({ week: "w", rows: [r(1), r(2)], me: r(80, true), nextCursor: "c" }, true).map((item) => item.id)).toEqual(["row-1", "row-2", "gap", "row-80"]);
    expect(globalItems({ week: "w", rows: [r(1), r(2)], me: r(3, true), nextCursor: "c" }, true).map((item) => item.id)).toEqual(["row-1", "row-2", "row-3"]);
    expect(globalItems({ week: "w", rows: [], me: null, nextCursor: null }, true)).toEqual([]);
  });

  it("the week ends in whole days and a started day counts", () => {
    const end = new Date(1_000_000_000);
    const before = (days: number) => new Date(end.getTime() - days * 86_400_000);
    expect([daysLeft(end, before(3)), daysLeft(end, before(2.2)), daysLeft(end, before(1 / 24)), daysLeft(end, new Date(end.getTime() + 500))]).toEqual([3, 3, 1, 1]);
    expect(daysLeftText(end, before(3))).toBe("۳ روز مونده تا آخر هفته");
  });

  it("the league is named after its tier", () => {
    expect([leagueName(2), leagueName(0), leagueName(9)]).toEqual(["لیگ غزل‌باز", "لیگ نوآموز", "لیگ استاد سخن"]);
  });
});

describe("the boards' model (LeaderboardModelTests)", () => {
  const answers = ({ path, query }: { path: string; query: string }) => {
    switch (path) {
      case "/v1/leaderboard/league":
        return ok({ ...league([row(1, "آرین", 10, { me: true })]) });
      case "/v1/leaderboard/friends":
        return ok({ week: "w", rows: [] });
      case "/v1/leaderboard/global":
        return query === "" ? ok({ week: "w", rows: [row(1, "a", 10)], me: null, nextCursor: "2" }) : ok({ week: "w", rows: [row(2, "b", 9)], me: null, nextCursor: null });
      default:
        return refuse(404, "not_found");
    }
  };

  it("each tab asks its own board once and keeps the answer", async () => {
    const server = fakeServer(answers);
    const model = new LeaderboardModel(server.api);
    await model.load();
    await model.load();
    expect(server.to("/v1/leaderboard/league")).toHaveLength(1);
    expect([model.snapshot().league?.tier, model.phaseOf("league").kind]).toEqual([2, "loaded"]);
    model.setTab("friends");
    await model.load();
    expect(model.snapshot().friends?.rows).toEqual([]);
    model.setTab("global");
    await model.load();
    await model.loadMoreGlobal();
    expect(model.snapshot().global?.rows.map((one) => one.rank)).toEqual([1, 2]);
    expect(model.hasMoreGlobal).toBe(false);
    expect(server.to("/v1/leaderboard/global").map((call) => call.query)).toEqual(["", "cursor=2"]);
    await model.load(true); // coming back
    expect(server.to("/v1/leaderboard/global")).toHaveLength(3);
  });

  it("a failed board says so and can be tried again; the tab not asked yet is loading", async () => {
    const server = fakeServer(() => "offline");
    const model = new LeaderboardModel(server.api);
    expect(model.phaseOf("friends")).toEqual({ kind: "loading" });
    await model.load();
    expect(model.phaseOf("league")).toEqual({ kind: "failed", message: new ApiError(0).persianMessage });
    server.respond(answers);
    await model.load();
    expect(model.phaseOf("league")).toEqual({ kind: "loaded" });
  });

  it("starts on the tab it is given", () => {
    expect(new LeaderboardModel(fakeServer(answers).api, "global").snapshot().tab).toBe("global");
  });
});
