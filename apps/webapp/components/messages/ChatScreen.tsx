"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Services } from "../../lib/account/services";
import { isUsername } from "../../lib/api/proxy";
import { useStore } from "../../lib/library/browser";
import { messageCopy } from "../../lib/messages/copy";
import type { ChatModel, Entry } from "../../lib/messages/chat";
import { bouncy, rowArrival, useVariant } from "../../lib/motion";
import { useAccount } from "../account/AccountProvider";
import { useServices } from "../account/useServices";
import { Busy, Note } from "../friends/chrome";
import { BackButton } from "../library/chrome";
import { toast } from "../ui/Toast";
import { DayLabel } from "./Bubbles";
import { ChatHeader } from "./ChatHeader";
import { CoupletMessage, DivanLine, PendingMessage, TextMessage } from "./ChatMessages";
import { GameCard } from "./GameCard";
import { Composer } from "./Composer";
import { NewMessageAnnouncer } from "./NewMessageAnnouncer";
import { CoupletPickerSheet } from "./CoupletPickerSheet";
import { useChatScroll } from "./useChatScroll";
import { useMessageActions } from "./useMessageActions";

/** The chat with one person, by their username (Messages/ChatScreen.swift). A guest gets the gate; a person who takes no messages from me says so. */
export function ChatScreen({ username }: { username: string }) {
  const services = useServices();
  return services ? <Opened services={services} username={username} /> : null;
}

function Opened({ services, username }: { services: Services; username: string }) {
  const account = useAccount();
  const status = useStore(services.session)?.status;
  const signedIn = status === "in";
  // What was opened is kept for the address it was opened for: the session settling (loading, then in) asks again, and must not draw the chat anew (it would lose what is being typed).
  const [opened, setOpened] = useState<{ username: string; result: { chat: ChatModel } | { error: string } }>();

  useEffect(() => {
    if (!isUsername(username)) return setOpened({ username, result: { error: "این آدم پیدا نشد" } });
    if (status === "guest") setOpened(undefined);
    let current = true;
    account.require("messages", () => void services.messages.openChat(username).then((result) => current && setOpened({ username, result })));
    return () => {
      current = false;
    };
  }, [username, signedIn]);

  const result = opened?.username === username ? opened.result : undefined;
  if (result && "chat" in result) return <ChatView key={result.chat.id} chat={result.chat} services={services} />;
  return (
    <div className="flex h-dvh flex-col px-[18px] pt-[calc(env(safe-area-inset-top)+8px)]">
      <div className="lg:hidden">
        <BackButton fallback="/messages" />
      </div>
      {result ? <Note top="pt-10">{result.error}</Note> : <Busy />}
    </div>
  );
}

function Row({ entry, chat, services, hold }: { entry: Entry; chat: ChatModel; services: Services; hold: ReturnType<typeof useMessageActions> }) {
  const { other } = useStore(chat)!;
  if (entry.kind === "day") return <DayLabel text={entry.label} />;
  if (entry.kind === "pending") return <PendingMessage pending={entry.pending} retry={() => chat.retry(entry.pending.clientId)} hold={() => hold.holdPending(entry.pending.clientId)} />;
  const { message, seen } = entry;
  const myId = services.session.user?.id;
  if (message.kind === "text" || (message.kind === "couplet" && message.deleted)) return <TextMessage message={message} other={other} seen={seen} hold={() => hold.holdMessage(message)} />;
  if (message.kind === "couplet") return <CoupletMessage message={message} other={other} seen={seen} hold={() => hold.holdMessage(message)} />;
  if (message.kind === "system" && message.payload?.event === "divan_add") return <DivanLine message={message} other={other} />;
  return <GameCard message={message} other={other} myId={myId} />;
}

function ChatView({ chat, services }: { chat: ChatModel; services: Services }) {
  const { phase, hasOlder, toast: line } = useStore(chat)!;
  const pathname = usePathname();
  const v = useVariant();
  const entries = chat.entries();
  const last = entries.at(-1);
  const scroll = useChatScroll(last?.rowId, last?.kind === "pending" || (last?.kind === "message" && last.message.fromMe));
  const hold = useMessageActions(chat);
  const [picking, setPicking] = useState(false);
  const [settled, setSettled] = useState(false);

  // The chat is looked at: on screen, the page in front, and no poem opened over it.
  useEffect(() => {
    const look = () => chat.setVisible(document.visibilityState === "visible" && !pathname.startsWith("/poem/"));
    look();
    document.addEventListener("visibilitychange", look);
    return () => {
      document.removeEventListener("visibilitychange", look);
      chat.setVisible(false);
    };
  }, [chat, pathname.startsWith("/poem/")]);
  useEffect(() => {
    void chat.load();
    void chat.loadLeague();
  }, [chat]);
  useEffect(() => {
    if (line) toast(line.line);
  }, [line?.serial]);
  useEffect(() => {
    if (phase.kind === "loaded") setSettled(true);
  }, [phase.kind]);
  // The top of the list is in view: the page before it is read.
  useEffect(() => {
    const node = scroll.topRef.current;
    if (!node || !hasOlder) return;
    const watch = new IntersectionObserver((seen) => seen.some((one) => one.isIntersecting) && void scroll.keepingPlace(() => chat.loadOlder()));
    watch.observe(node);
    return () => watch.disconnect();
  }, [hasOlder, entries[0]?.id]);
  const arrival = rowArrival(v);

  return (
    <div data-testid="chat" className="flex h-dvh flex-col">
      <ChatHeader chat={chat} />
      <div
        ref={scroll.list}
        onScroll={scroll.onScroll}
        // A tap on the messages puts the keyboard away (the composer is not part of this list: its send button keeps it).
        onPointerDown={() => (document.activeElement as HTMLElement | null)?.closest("[data-testid=composer]") && (document.activeElement as HTMLElement).blur()}
        data-testid="chat-list"
        className="relative flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-[18px] pt-1.5 pb-2"
      >
        {phase.kind === "failed" && (
          <div className="flex flex-col items-center gap-2 pt-10">
            <Note>{phase.message}</Note>
            <button type="button" onClick={() => void chat.load()} className="text-sm font-bold text-lapis">
              دوباره
            </button>
          </div>
        )}
        {phase.kind === "loading" && <Busy />}
        <div ref={scroll.topRef} aria-hidden className="h-px shrink-0" />
        {entries.map((entry) => (
          <motion.div
            key={entry.rowId}
              // A message that arrives or is sent springs in; the first load, and older pages, do not.
              initial={settled && entry === last ? arrival : false}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={bouncy}
            className="flex w-full flex-col"
          >
            <Row entry={entry} chat={chat} services={services} hold={hold} />
          </motion.div>
        ))}
        {scroll.newBelow && (
          <button
            type="button"
            data-testid="new-message-pill"
            onClick={() => scroll.toBottom(true)}
            className="sticky bottom-1 mx-auto shrink-0 rounded-full border-2 border-white bg-lapis px-3.5 py-2 text-[13px] font-bold text-white"
          >
            {messageCopy.newMessage}
          </button>
        )}
      </div>
      <NewMessageAnnouncer chat={chat} />
      <Composer chat={chat} pick={() => setPicking(true)} />
      <CoupletPickerSheet open={picking} onClose={() => setPicking(false)} title="بیت بفرست" action="بفرست" choose={(key, note) => chat.sendCouplet(key, note)} />
      {hold.sheets}
    </div>
  );
}
