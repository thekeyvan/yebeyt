"use client";

import Link from "next/link";
import { cn } from "../../lib/cn";
import { feedbackPrivate } from "../../lib/feedbackPrivate";
import { chatTime } from "../../lib/messages/copy";
import { inboxPreview } from "../../lib/messages/inbox";
import { chatName, type ConversationItem } from "../../lib/messages/models";
import { ChatFace } from "./ChatFace";

/** One chat of the inbox: the face, the name, the last line (private: it is message text), the time and the dot when something is unread (Messages/InboxScreen.swift `InboxRow`). */
export function InboxRow({ row, last, open, active, now }: { row: ConversationItem; last: boolean; open: () => void; active: boolean; now: Date }) {
  const unread = row.unread > 0;
  const name = chatName(row.other);
  return (
    <Link
      href={`/messages/${row.other.username}`}
      onClick={open}
      data-testid={`inbox-row-${row.other.username}`}
      data-unread={row.unread}
      aria-current={active ? "page" : undefined}
      aria-label={`${name}، ${inboxPreview(row.last)}${unread ? "، نخونده" : ""}`}
      className={cn("flex items-center gap-3 border-b border-chip-border py-2.5", last && "border-b-0", active && "lg:-mx-4 lg:rounded-2xl lg:bg-paper lg:px-4")}
    >
      <ChatFace parts={row.other.avatar} size={52} online={row.other.online === true} />
      <span className="flex min-w-0 flex-1 flex-col items-start">
        <span className={cn("max-w-full truncate text-[15px] text-ink", unread ? "font-bold" : "font-medium")}>{name}</span>
        <span {...feedbackPrivate} className={cn("max-w-full truncate text-[13px]", unread ? "font-medium text-ink" : "text-muted")}>
          {inboxPreview(row.last)}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-xs text-muted">{chatTime.stamp(new Date(row.last.at), now)}</span>
        <span aria-hidden data-testid={unread ? "unread-dot" : undefined} className={cn("size-2.5 rounded-full", unread ? "bg-lapis" : "bg-transparent")} />
      </span>
    </Link>
  );
}
