"use client";

import Link from "next/link";
import type { ChatModel } from "../../lib/messages/chat";
import { chatName } from "../../lib/messages/models";
import { useStore } from "../../lib/library/browser";
import { BackButton } from "../library/chrome";
import { SharedDivanIcon } from "../ui/icons";
import { ChatFace } from "./ChatFace";

/** The top of a chat: back, the face, the name with «آنلاین · لیگ غزل‌باز», and «دیوان مشترک» (Messages/ChatScreen.swift `header`). From 1024 px the inbox is beside the chat, so there is no way back. */
export function ChatHeader({ chat }: { chat: ChatModel }) {
  const { other } = useStore(chat)!;
  const name = chatName(other);
  const status = chat.statusLine;
  return (
    <header className="flex items-center gap-2.5 px-[18px] pt-[calc(env(safe-area-inset-top)+8px)] pb-1">
      <div className="lg:hidden">
        <BackButton fallback="/messages" />
      </div>
      <ChatFace parts={other.avatar} size={46} padding={4} online={other.online === true} />
      <div className="min-w-0 flex-1">
        <h1 data-testid="chat-name" className="truncate font-ui text-[17px] leading-[1.5] font-bold text-ink">
          {name}
        </h1>
        {status && (
          <p data-testid="chat-status" className="text-xs text-muted">
            {status}
          </p>
        )}
      </div>
      <Link
        href={`/messages/${other.username}/divan`}
        data-testid="shared-divan-link"
        aria-label={`دیوان مشترک با ${name}`}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-bold text-lapis shadow-[0_2px_16px_rgba(20,17,43,0.1)]"
      >
        <SharedDivanIcon size={18} lineWidth={2.2} />
        دیوان مشترک
      </Link>
    </header>
  );
}
