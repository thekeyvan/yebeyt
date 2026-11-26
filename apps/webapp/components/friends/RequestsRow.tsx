"use client";

import Link from "next/link";
import { friendCopy } from "../../lib/friends/friendship";
import { useStore } from "../../lib/library/browser";
import { persianDigits } from "../../lib/persian";
import { useServices } from "../account/useServices";
import { AddPersonIcon } from "./icons";

/** «درخواست‌های دوستی» with its count, at the top of پیام‌ها while someone's request waits for an answer (Messages/InboxScreen.swift `RequestsRow`). */
export function RequestsRow() {
  const count = useStore(useServices()?.friends.requests)?.incomingCount ?? 0;
  if (count === 0) return null;
  return (
    <Link
      href="/messages/requests"
      data-testid="requests-row"
      aria-label={`${friendCopy.requestsTitle}، ${persianDigits(count)}`}
      className="flex items-center gap-3 rounded-3xl bg-white px-4 py-2.5 shadow-[0_3px_12px_rgba(20,17,43,0.08)]"
    >
      <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full border-[3px] border-white bg-amber text-ink shadow-[0_2px_8px_rgba(20,17,43,0.18)]">
        <AddPersonIcon />
      </span>
      <span className="flex-1 text-[15px] font-bold text-ink">{friendCopy.requestsTitle}</span>
      <span aria-hidden data-testid="requests-count" className="grid min-h-[26px] min-w-[26px] place-items-center rounded-full bg-lapis px-1 text-[13px] font-bold text-white">
        {persianDigits(count)}
      </span>
    </Link>
  );
}
