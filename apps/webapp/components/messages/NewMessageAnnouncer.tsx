"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatModel } from "../../lib/messages/chat";
import { feedbackPrivate } from "../../lib/feedbackPrivate";
import { chatName } from "../../lib/messages/models";
import { useStore } from "../../lib/library/browser";

/**
 * A polite live region that says a new message of the other person's as it arrives (the phone says the bubble aloud). It says nothing for the first load, for older pages
 * added at the top, or for what I send: only the newest message changing, to one that is theirs. It is message text, so it is private to the feedback screenshot.
 */
export function NewMessageAnnouncer({ chat }: { chat: ChatModel }) {
  const { messages, phase, other } = useStore(chat)!;
  const newest = messages.at(-1);
  const seen = useRef<string | undefined>(undefined);
  const primed = useRef(false);
  const [line, setLine] = useState("");

  useEffect(() => {
    if (phase.kind !== "loaded") return;
    if (!primed.current) {
      primed.current = true; // what the first load brought is not news
      seen.current = newest?.id;
      return;
    }
    if (!newest || newest.id === seen.current) return;
    seen.current = newest.id;
    if (newest.fromMe || newest.deleted) return;
    if (newest.kind === "text") setLine(`${chatName(other)}: ${newest.text ?? ""}`);
    else if (newest.kind === "couplet") setLine(`${chatName(other)} یه بیت برات فرستاد`);
  }, [phase.kind, newest?.id]);

  return (
    <div {...feedbackPrivate} role="status" aria-live="polite" data-testid="new-message-announcer" className="sr-only">
      {line}
    </div>
  );
}
