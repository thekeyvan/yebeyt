"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Services } from "../../lib/account/services";
import { boardTabs, LeaderboardModel, type BoardTab } from "../../lib/friends/leaderboard";
import { friendsItems, globalItems, hasNoFriends, leagueItems } from "../../lib/friends/leaderboardLayout";
import { useStore } from "../../lib/library/browser";
import { useAccount } from "../account/AccountProvider";
import { BackButton } from "../library/chrome";
import { WithServices } from "../me/WithServices";
import { Screen } from "../shell/Screen";
import { SegmentPage } from "../ui/SegmentPage";
import { Segmented } from "../ui/Segmented";
import { BoardCard } from "./BoardCard";
import { Busy, Note } from "./chrome";
import { LeagueCard } from "./LeagueCard";

const order = boardTabs.map((tab) => tab.value);
const link = "text-center text-sm font-bold text-lapis";

/** رده‌بندی (LeaderboardS): three tabs, the league's name and the days left, and plain rows with medals for 1–3, my own row tinted, and the green band after the five who move up (Friends/Leaderboard/LeaderboardScreen.swift). `tab` is the one it starts on. */
export function LeaderboardScreen({ tab }: { tab: BoardTab }) {
  return <WithServices>{(services) => <Leaderboard services={services} first={tab} />}</WithServices>;
}

function Leaderboard({ services, first }: { services: Services; first: BoardTab }) {
  const account = useAccount();
  const model = useMemo(() => new LeaderboardModel(services.api, first), [services, first]);
  const state = useStore(model)!;
  const { status } = useStore(services.session)!;
  const [now] = useState(() => new Date());

  // The boards are the account's: a guest gets the gate, and the tab loads after the sign-in.
  useEffect(() => {
    account.require("leaderboard", () => void model.load());
  }, [model, state.tab, status === "in"]);

  return (
    <Screen
      header={
        <div className="flex items-center gap-3">
          <BackButton fallback="/games" />
          <h1 className="flex-1 text-[32px] leading-[1.3] text-ink">رده‌بندی</h1>
        </div>
      }
    >
      <div className="flex flex-col gap-3.5 pt-1.5">
        <div className="shadow-[0_2px_4px_rgba(20,17,43,0.12)] rounded-pill">
          <Segmented value={state.tab} onValueChange={(next) => model.setTab(next)} options={boardTabs} label="رده‌بندی" look="pill" stretch />
        </div>
        <SegmentPage value={state.tab} order={order}>
          <div className="flex flex-col gap-3.5">
            <Board services={services} model={model} state={state} now={now} />
          </div>
        </SegmentPage>
      </div>
    </Screen>
  );
}

type BoardProps = { services: Services; model: LeaderboardModel; state: ReturnType<LeaderboardModel["snapshot"]>; now: Date };

function Board({ services, model, state, now }: BoardProps) {
  const phase = model.phaseOf(state.tab);
  const inGlobal = (useStore(services.privacy) ?? services.privacy.settings).inGlobalLeaderboard;
  if (phase.kind === "loading") return <Busy />;
  if (phase.kind === "failed") return <Note testId="board-failed" top="pt-10">{phase.message}</Note>;

  if (state.tab === "league" && state.league) {
    return (
      <>
        <LeagueCard tier={state.league.tier} endsAt={state.league.endsAt} now={now} />
        {state.league.rows.length === 0 ? (
          <Note testId="league-empty" top="pt-5">هنوز امتیازی نگرفتی. یه دور بازی کن تا وارد لیگ بشی.</Note>
        ) : (
          <BoardCard items={leagueItems(state.league)} />
        )}
      </>
    );
  }
  if (state.tab === "friends" && state.friends) {
    return hasNoFriends(state.friends) ? (
      <>
        <Note testId="friends-empty" top="pt-5">هنوز دوستی نداری. از «پیدا کردن دوست» شروع کن.</Note>
        <Link href="/people" data-testid="find-friends" className={link}>
          پیدا کردن دوست
        </Link>
      </>
    ) : (
      <BoardCard items={friendsItems(state.friends)} />
    );
  }
  if (state.tab === "global" && state.global) {
    const items = globalItems(state.global, inGlobal);
    return (
      <>
        {inGlobal && items.length === 0 ? <Note testId="global-empty" top="pt-5">این هفته هنوز کسی امتیاز نگرفته</Note> : <BoardCard items={items} reachedEnd={inGlobal && model.hasMoreGlobal ? () => void model.loadMoreGlobal() : undefined} />}
        {!inGlobal && (
          <>
            <Note testId="global-hidden" top="pt-5">اسمت توی رده‌بندی همه نیست</Note>
            <Link href="/me/privacy" data-testid="open-privacy" className={link}>
              حریم خصوصی
            </Link>
          </>
        )}
      </>
    );
  }
  return null;
}
