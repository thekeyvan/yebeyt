"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { ChatModel } from "../../lib/messages/chat";
import { feedbackPrivate } from "../../lib/feedbackPrivate";
import { messageCopy } from "../../lib/messages/copy";
import type { ChatPerson } from "../../lib/messages/models";
import { useStore } from "../../lib/library/browser";
import { MessagesIcon } from "../ui/icons";
import Link from "next/link";
import { toast } from "../ui/Toast";
import { CoupletIcons } from "./CoupletIcons";

const chip = "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3 py-[7px] text-[13px] font-bold text-ink shadow-[0_2px_8px_rgba(20,17,43,0.14)]";

/** «بیت بفرست», the two games with this friend (not for someone who can't play) and today's puzzle (Messages/ChatScreen.swift `quickActions`). Until the games with friends are on the web (W8) the two games say so. */
function QuickActions({ other, pick }: { other: ChatPerson; pick: () => void }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-0.5 [scrollbar-width:none]">
      <button type="button" data-testid="quick-couplet" onClick={pick} className={chip}>
        <CoupletIcons.Pair />
        بیت بفرست
      </button>
      {other.canPlay !== false && (
        <>
          <button type="button" data-testid="quick-mosh" onClick={() => toast(messageCopy.soon)} className={chip}>
            <CoupletIcons.Arrows />
            مشاعره
          </button>
          <button type="button" data-testid="quick-duel" onClick={() => toast(messageCopy.soon)} className={chip}>
            <CoupletIcons.Games />
            بازی رودررو
          </button>
        </>
      )}
      <Link href="/games/daily" data-testid="quick-daily" className={chip}>
        <CoupletIcons.Daily />
        معمای امروز
      </Link>
    </div>
  );
}

/**
 * The bottom of the chat: the quick actions and the field with its send button, or a line when the chat is closed. Enter sends; Escape puts the keyboard away; the send
 * button keeps it up (the phone's composer is one line, so there is no new line to make).
 */
export function Composer({ chat, pick }: { chat: ChatModel; pick: () => void }) {
  const { isClosed, other } = useStore(chat)!;
  const [draft, setDraft] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const send = () => chat.send(draft) && setDraft("");
  const keys = (event: KeyboardEvent) => event.key === "Escape" && field.current?.blur();

  if (isClosed) {
    return (
      <footer className="px-4 pt-1.5 pb-[max(16px,env(safe-area-inset-bottom))]">
        <p data-testid="closed-line" className="rounded-full bg-white px-4 py-3 text-center text-[13px] font-medium text-muted shadow-[0_2px_8px_rgba(20,17,43,0.1)]">
          {messageCopy.closed}
        </p>
      </footer>
    );
  }
  return (
    <footer className="flex flex-col gap-2.5 px-4 pt-1.5 pb-[max(16px,env(safe-area-inset-bottom))]">
      <QuickActions other={other} pick={pick} />
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <input
          ref={field}
          {...feedbackPrivate}
          data-testid="composer"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={keys}
          enterKeyHint="send"
          autoComplete="off"
          aria-label="پیام بنویس…"
          placeholder="پیام بنویس…"
          className="h-12 min-w-0 flex-1 rounded-full bg-white px-4 text-[15px] text-ink shadow-[0_2px_5px_rgba(20,17,43,0.16)] outline-none placeholder:text-[#8A8698]"
        />
        <button
          type="submit"
          aria-label="فرستادن"
          data-testid="send"
          onPointerDown={(event) => event.preventDefault()}
          className="grid size-12 shrink-0 place-items-center rounded-full border-[3px] border-white bg-lapis text-white shadow-[0_2px_5px_rgba(20,17,43,0.22)]"
        >
          <span className="-scale-x-100">
            <MessagesIcon size={20} lineWidth={2.4} />
          </span>
        </button>
      </form>
    </footer>
  );
}
