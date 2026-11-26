"use client";

import Link from "next/link";
import { cn } from "../../lib/cn";
import { type LeaderboardEntry, type LeaderboardItem, type Medal } from "../../lib/friends/leaderboardLayout";
import { persianDigits } from "../../lib/persian";
import { FacePerson } from "./FacePerson";
import { UpArrowIcon } from "./icons";
import { useEndOfList } from "./useEndOfList";

const medalLook: Record<Medal, string> = { gold: "bg-amber", silver: "bg-[#D3D6DE]", bronze: "bg-[#E8955A]" };

function Rank({ entry }: { entry: LeaderboardEntry }) {
  if (!entry.medal) return <span className="w-8 shrink-0 text-center text-[15px] font-bold text-muted">{entry.rankText}</span>;
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border-[3px] border-white pt-[3px] font-title text-base leading-none text-ink shadow-[0_1px_2.5px_rgba(20,17,43,0.25)]", medalLook[entry.medal])}>
      {entry.rankText}
    </span>
  );
}

/** A row: the rank (a medal for 1–3), the face, the name and the points; my own row is tinted, and a person's row opens their page (Friends/Leaderboard/LeaderboardScreen.swift `BoardRow`). */
function BoardRow({ entry, last }: { entry: LeaderboardEntry; last: boolean }) {
  const row = (
    <div
      data-testid={`board-row-${entry.rank}`}
      aria-label={`نفر ${entry.rankText}، ${entry.name}، ${entry.points}`}
      className={cn("flex h-[54px] items-center gap-3 px-4", entry.isMe && "bg-lapis-tint", !last && "border-b border-chip-border")}
    >
      <Rank entry={entry} />
      <FacePerson parts={entry.avatar} size={34} plain={entry.isHidden} />
      <span className={cn("min-w-0 flex-1 truncate text-[15px]", entry.isMe ? "font-bold text-lapis" : "text-ink")}>{entry.name}</span>
      <span className="text-[15px] font-bold text-ink">{entry.points}</span>
    </div>
  );
  return entry.opens ? <Link href={`/u/${entry.opens}`}>{row}</Link> : row;
}

/** The white card of rows; `reachedEnd` is called when its last row scrolls into view (the next page of the global list). */
export function BoardCard({ items, reachedEnd }: { items: readonly LeaderboardItem[]; reachedEnd?: () => void }) {
  const end = useEndOfList(items.at(-1)?.id, () => reachedEnd?.());
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-[0_3px_6px_rgba(20,17,43,0.12)]">
      {items.map((item, index) => {
        switch (item.kind) {
          case "entry":
            return <BoardRow key={item.id} entry={item.entry} last={index === items.length - 1} />;
          case "gap":
            return (
              <p key={item.id} aria-hidden className="grid h-7 place-items-center text-lg font-bold text-muted">
                …
              </p>
            );
          case "promoteBand":
            return (
              <p key={item.id} data-testid="promote-band" className="flex items-center justify-center gap-1.5 bg-green py-[5px] text-xs font-bold text-ink">
                <UpArrowIcon />
                این {persianDigits(item.count)} نفر می‌رن لیگ بالاتر
              </p>
            );
        }
      })}
      <div ref={end} />
    </div>
  );
}
