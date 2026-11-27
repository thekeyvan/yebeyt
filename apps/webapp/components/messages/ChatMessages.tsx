"use client";

import Link from "next/link";
import { messageCopy, chatTime, divanAdded } from "../../lib/messages/copy";
import { gameLine } from "../../lib/messages/gameLine";
import { chatName, type ChatPerson, type Message } from "../../lib/messages/models";
import type { Pending } from "../../lib/messages/chat";
import { SharedDivanIcon } from "../ui/icons";
import { toast } from "../ui/Toast";
import { Holdable, MessageMeta, PendingLine, TextBubble } from "./Bubbles";
import { CoupletCard } from "./CoupletCard";

const clock = (message: Pick<Message, "createdAt">) => chatTime.clock(new Date(message.createdAt));

/** A text of either person: the bubble and its time; a long press reports it (theirs) or takes it back (mine). A deleted one says so, muted. */
export function TextMessage({ message, seen, hold }: { message: Message; seen: boolean; hold: () => void }) {
  const mine = message.fromMe;
  return (
    <Holdable mine={mine} testId={`bubble-${message.id}`} onHold={message.deleted ? () => {} : hold}>
      <TextBubble text={message.deleted ? messageCopy.deletedMessage : (message.text ?? "")} mine={mine} muted={message.deleted} />
      <MessageMeta time={clock(message)} mine={mine} seen={seen} />
    </Holdable>
  );
}

/** A couplet sent in the chat: the sender line, the card, the note under it (Messages/ChatBubbles.swift `CoupletMessageView`). */
export function CoupletMessage({ message, other, seen, hold }: { message: Message; other: ChatPerson; seen: boolean; hold: () => void }) {
  const mine = message.fromMe;
  const time = clock(message);
  return (
    <div data-testid={`couplet-message-${message.id}`} className={`flex w-full flex-col gap-1.5 ${mine ? "items-end" : "items-start"}`}>
      <Holdable mine={mine} onHold={hold}>
        <span className="text-xs text-muted">
          {mine ? (
            `تو یه بیت فرستادی · ${time}`
          ) : (
            <>
              <b className="text-ink">{chatName(other)}</b> یه بیت برات فرستاد · {time}
            </>
          )}
        </span>
      </Holdable>
      <CoupletCard coupletKey={message.key ?? ""} id={message.id} mine={mine} />
      {message.note ? (
        <Holdable mine={mine} onHold={hold}>
          <TextBubble text={message.note} mine={mine} />
          <MessageMeta time={time} mine={mine} seen={seen} />
        </Holdable>
      ) : (
        mine && <MessageMeta time={time} mine seen={seen} />
      )}
    </div>
  );
}

/** A send on its way, or one that failed (Messages/ChatBubbles.swift `PendingMessageView`). */
export function PendingMessage({ pending, retry, hold }: { pending: Pending; retry: () => void; hold: () => void }) {
  const { content } = pending;
  return (
    <Holdable mine testId={`pending-${pending.clientId}`} onHold={pending.failed ? hold : () => {}}>
      {content.kind === "text" ? (
        <TextBubble text={content.text} mine faded />
      ) : (
        <>
          <CoupletCard coupletKey={content.key} id={pending.clientId} mine />
          {content.note && <TextBubble text={content.note} mine faded />}
        </>
      )}
      <PendingLine pending={pending} retry={retry} />
    </Holdable>
  );
}

/** «سارا یه بیت به دیوان مشترک اضافه کرد»: a tap opens the shared divan. */
export function DivanLine({ message, other }: { message: Message; other: ChatPerson }) {
  const text = message.fromMe ? messageCopy.divanAddedByMe : divanAdded(chatName(other));
  return (
    <Link href={`/messages/${other.username}/divan`} data-testid={`divan-line-${message.id}`} className="mx-auto flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-[5px] text-xs text-muted">
      <span className="text-lapis">
        <SharedDivanIcon size={16} lineWidth={2.2} />
      </span>
      {text}
    </Link>
  );
}

/** A game line of a chat: an invitation with its button, or a line (a game that ended, the result of a challenge). Until the games with friends are on the web (W8) a button says so (Messages/GameCardView.swift). */
export function GameLine({ message, other, myId }: { message: Message; other: ChatPerson; myId: string | undefined }) {
  const line = gameLine(message, other, myId);
  if (!line) return null;
  if (line.kind === "line") {
    return (
      <p data-testid={`game-line-${message.id}`} className="mx-auto rounded-full bg-white/80 px-3 py-[5px] text-xs text-muted">
        {line.text}
      </p>
    );
  }
  const mine = message.fromMe;
  return (
    <div className={`flex w-full flex-col gap-1.5 ${mine ? "items-end" : "items-start"}`}>
      <span className="text-xs text-muted">{`${mine ? "تو" : chatName(other)} · ${clock(message)}`}</span>
      <div data-testid={`game-card-${message.id}`} className="flex w-[262px] max-w-full items-center gap-3 rounded-[22px] bg-white p-3.5 shadow-[0_3px_8px_rgba(20,17,43,0.14)]">
        <span className="flex-1 text-[13px] font-bold text-ink">{line.text}</span>
        {line.button && (
          <button type="button" data-testid={`game-go-${message.id}`} onClick={() => toast(messageCopy.soon)} className="rounded-xl bg-lapis px-[13px] pt-[7px] pb-[3px] font-title text-base text-white">
            {line.button.title}
          </button>
        )}
      </div>
    </div>
  );
}
