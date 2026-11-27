"use client";

import { useRouter } from "next/navigation";
import type { Services } from "../../lib/account/services";
import { PeoplePickSheet } from "../friends/PeoplePickSheet";

/** «پیام تازه»: the people search in a mode for choosing someone; a tap opens the chat with them (Friends/PeoplePickSheet.swift `NewChatSheet`). */
export function NewChatSheet({ services, open, onClose }: { services: Services; open: boolean; onClose: () => void }) {
  const router = useRouter();
  return (
    <PeoplePickSheet
      services={services}
      open={open}
      onClose={onClose}
      title="پیام تازه"
      testPrefix="new-chat"
      choose={async ({ username }) => {
        const opened = await services.messages.openChat(username);
        if ("error" in opened) return opened.error;
        router.push(`/messages/${username}`);
        return undefined;
      }}
    />
  );
}
