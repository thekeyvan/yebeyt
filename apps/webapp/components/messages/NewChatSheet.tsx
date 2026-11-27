"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Services } from "../../lib/account/services";
import { PeopleSearchModel } from "../../lib/friends/search";
import { nameOf } from "../../lib/friends/models";
import { feedbackPrivate } from "../../lib/feedbackPrivate";
import { useStore } from "../../lib/library/browser";
import { FacePerson } from "../friends/FacePerson";
import { Busy, Note } from "../friends/chrome";
import { SearchBox } from "../library/chrome";
import { NothingFound } from "../library/rows";
import { Sheet } from "../ui/Sheet";
import { toast } from "../ui/Toast";

/** «پیام تازه»: the people search in a mode for choosing someone; a tap opens the chat with them (Friends/PeoplePickSheet.swift `NewChatSheet`). */
export function NewChatSheet({ services, open, onClose }: { services: Services; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const model = useMemo(() => new PeopleSearchModel(services.api, services.friends), [services]);
  const { people, phase } = useStore(model)!;
  const [text, setText] = useState("");
  const visible = services.friends.blocked.visible(people, (one) => one.username);

  async function pick(username: string) {
    const opened = await services.messages.openChat(username);
    if ("error" in opened) return toast(opened.error);
    onClose();
    router.push(`/messages/${username}`);
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()} title="پیام تازه">
      <div className="flex min-h-[40dvh] w-full flex-col gap-3">
        <div {...feedbackPrivate}>
          <SearchBox
            round
            autoFocus
            value={text}
            onChange={(value) => {
              setText(value);
              model.queryChanged(value);
            }}
            placeholder="نام کاربری…"
          />
        </div>
        {phase.kind === "failed" ? (
          <Note>{phase.message}</Note>
        ) : phase.kind === "loading" && visible.length === 0 ? (
          <Busy />
        ) : phase.kind === "loaded" && visible.length === 0 ? (
          <NothingFound />
        ) : (
          visible.map((person) => (
            <button key={person.username} type="button" data-testid={`new-chat-${person.username}`} onClick={() => void pick(person.username)} className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-2 text-start shadow-[0_2px_5px_rgba(20,17,43,0.06)]">
              <FacePerson parts={person.avatar} size={44} />
              <span className="flex min-w-0 flex-col items-start">
                <span className="max-w-full truncate text-[15px] font-bold text-ink">{nameOf(person)}</span>
                <span dir="ltr" className="max-w-full truncate text-xs text-muted">
                  @{person.username}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </Sheet>
  );
}
