"use client";

import Link from "next/link";
import { action, coupletRoute, isTodaysDaily, relativeTime } from "../../lib/friends/feedText";
import { shown } from "../../lib/friends/feed";
import type { FeedItem, ReactionCounts } from "../../lib/friends/models";
import { nameOf } from "../../lib/friends/models";
import { useLibraryData } from "../../lib/library/browser";
import { persianDigits } from "../../lib/persian";
import { routeURL } from "../../lib/reader/route";
import { useDivanEntries } from "../me/useDivanEntries";
import { useMarkActions } from "../reader/useCoupletActions";
import { MarkButton } from "../ui/MarkButton";
import { BookmarkIcon, HeartIcon, MessagesIcon, RepostIcon } from "../ui/icons";
import { FacePerson } from "./FacePerson";

/** An icon with its count: magenta ♥ and lapis repost when on, as on the Calm board; ink otherwise. */
const Count = ({ n }: { n: number | undefined }) => (n ? <span className="text-xs font-bold">{persianDigits(n)}</span> : null);

/**
 * One thing a friend did (Friends/Feed/FeedSection.swift `FeedCard`): their face, «کیان یه بیت به اشتراک گذاشت» over how long ago, and for a couplet the couplet (tap to read
 * it) with ♥ and repost counts, send and keep; for the day's puzzle «تو هم» when it is today's.
 */
export function FeedCard({ item, counts, now }: { item: FeedItem; counts: ReactionCounts | undefined; now: Date }) {
  const route = item.key ? coupletRoute(item.key) : undefined;
  const { entries } = useDivanEntries(route && item.key ? [{ key: item.key }] : []);
  const { value: data } = useLibraryData();
  const entry = entries[0];
  const poet = (entry && data?.library.poet(entry.poetSlug)?.name) ?? "";
  const marks = useMarkActions(route && { path: route.path, poet, title: entry?.title ?? "", line: entry?.couplet }, route?.couplet ?? 0);
  return (
    <article data-testid="feed-item" className={`flex flex-col gap-2.5 rounded-[22px] bg-white px-3.5 pt-3 shadow-[0_3px_6px_rgba(20,17,43,0.08)] ${route ? "pb-1.5" : "pb-3"}`}>
      <div className="flex items-center gap-2.5">
        <FacePerson parts={item.user.avatar} size={36} />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-sm text-ink">
            <b>{nameOf(item.user)}</b> {action(item, now)}
          </p>
          <p className="text-xs text-muted">{relativeTime(item.at, now)}</p>
        </div>
        {isTodaysDaily(item, now) && (
          <Link href="/games/daily" data-testid="feed-join-daily" className="text-[13px] font-bold text-lapis">
            تو هم
          </Link>
        )}
      </div>
      {route && entry && (
        <Link href={routeURL(route.path, route.couplet, "couplet")} data-testid="feed-couplet" className="flex flex-col items-center rounded-2xl bg-board-paper px-3 py-2.5 text-center font-poem text-lg leading-[2.1] text-ink">
          <span>{entry.couplet.m1}</span>
          {entry.couplet.m2 && <span>{entry.couplet.m2}</span>}
          <span className="pt-0.5 font-ui text-xs leading-normal text-muted">{poet}</span>
        </Link>
      )}
      {route && (
        <div className="flex items-center">
          <div className="flex items-center gap-3.5">
            <MarkButton action="like" label="پسند این بیت" selected={marks.liked} onPress={marks.like} className={`flex items-center gap-1 p-1 ${marks.liked ? "text-magenta" : "text-ink"}`} caption={<Count n={counts && shown(counts.likes, counts.likedByMe, marks.liked)} />}>
              <HeartIcon size={20} lineWidth={2.2} fill={marks.liked ? "currentColor" : undefined} />
            </MarkButton>
            <MarkButton action="repost" label="بازنشر این بیت" selected={marks.reposted} onPress={marks.repost} className={`flex items-center gap-1 p-1 ${marks.reposted ? "text-lapis" : "text-ink"}`} caption={<Count n={counts && shown(counts.reposts, counts.repostedByMe, marks.reposted)} />}>
              <RepostIcon size={20} lineWidth={2.2} />
            </MarkButton>
            <MarkButton action="send" label="بفرست این بیت" onPress={marks.send} className="p-1 text-ink">
              <MessagesIcon size={20} lineWidth={2.2} />
            </MarkButton>
          </div>
          <span className="flex-1" />
          <MarkButton action="keep" label="نگه داشتن این بیت" selected={marks.kept} onPress={marks.keep} className="p-1 text-ink">
            <BookmarkIcon size={20} lineWidth={2.2} fill={marks.kept ? "currentColor" : undefined} />
          </MarkButton>
        </div>
      )}
    </article>
  );
}
