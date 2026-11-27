"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { feedbackPrivate } from "../../lib/feedbackPrivate";
import { messageCopy } from "../../lib/messages/copy";
import type { Pending } from "../../lib/messages/chat";
import { boardPath, linked } from "../../lib/play/challengeLink";
import { useLongPress } from "../reader/useLongPress";

/** The words under a bubble: «۹:۴۰» for the other person's, «تو · ۹:۴۲ · دیده شد» for mine (Messages/ChatBubbles.swift `MessageMeta`). */
export function MessageMeta({ time, mine, seen = false }: { time: string; mine: boolean; seen?: boolean }) {
  return (
    <span data-testid={seen ? "seen" : undefined} className="text-[11px] text-muted">
      {mine ? `تو · ${time}${seen ? ` · ${messageCopy.seen}` : ""}` : time}
    </span>
  );
}

/** One text bubble: white and a straight corner at the top for the other person, lapis for me; the link of a challenge in it opens its board (Messages/ChatBubbles.swift). It is message text, so it is private to the feedback screenshot. */
export function TextBubble({ text, mine, muted = false, faded = false }: { text: string; mine: boolean; muted?: boolean; faded?: boolean }) {
  return (
    <p
      {...feedbackPrivate}
      className={cn(
        "max-w-[250px] whitespace-pre-wrap break-words rounded-[20px] px-3.5 py-[9px] text-[15px] leading-[1.9]",
        mine ? "rounded-se-[6px] bg-lapis text-white" : "rounded-ss-[6px] bg-white shadow-[0_2px_4px_rgba(20,17,43,0.1)]",
        !mine && (muted ? "bg-white/60 text-muted" : "text-ink"),
        faded && "opacity-85",
      )}
    >
      {linked(text).map((part, index) =>
        part.code ? (
          <Link key={index} href={boardPath(part.code)} prefetch={false} data-testid="challenge-link-in-chat" className="underline">
            {part.text}
          </Link>
        ) : (
          part.text
        ),
      )}
    </p>
  );
}

/** «امروز»: the label between days. */
export function DayLabel({ text }: { text: string }) {
  return (
    <span data-testid="day-label" className="mx-auto rounded-full bg-white/80 px-3 py-0.5 text-xs text-muted">
      {text}
    </span>
  );
}

/** What a message does on a long press, a right click or the menu key: the chat opens its sheet for it (the phone's context menu). It is focusable for the key, and named as the phone reads a bubble: «سارا: سلام، ۹:۴۰» (`label`). */
export function Holdable({ onHold, testId, mine, label, children }: { onHold: () => void; testId?: string; mine: boolean; label: string; children: ReactNode }) {
  const hold = useLongPress(onHold);
  return (
    <div {...hold} role="group" aria-label={label} tabIndex={0} data-testid={testId} className={cn("flex w-full flex-col gap-[3px] outline-offset-4 select-none", mine ? "items-end" : "items-start")}>
      {children}
    </div>
  );
}

/** A send on its way: «در حال فرستادن», or «نرسید · دوباره» to tap when it failed (a send the server refused for good only says «نرسید»). */
export function PendingLine({ pending, retry }: { pending: Pending; retry: () => void }) {
  if (pending.refused) return <span className="text-[11px] font-bold text-fire">{messageCopy.refused}</span>;
  if (pending.failed) {
    return (
      <button type="button" data-testid={`retry-${pending.clientId}`} onClick={retry} className="text-[11px] font-bold text-fire">
        {messageCopy.notSent}
      </button>
    );
  }
  return <span className="text-[11px] text-muted">{messageCopy.sending}</span>;
}
