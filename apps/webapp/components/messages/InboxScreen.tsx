"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Services } from "../../lib/account/services";
import { accountFeatures } from "../../lib/account/features";
import { feedbackPrivate } from "../../lib/feedbackPrivate";
import { useStore } from "../../lib/library/browser";
import { useAccount } from "../account/AccountProvider";
import { useServices } from "../account/useServices";
import { Busy, Note } from "../friends/chrome";
import { PencilIcon } from "../me/icons";
import { RequestsRow } from "../friends/RequestsRow";
import { RoundButton, SearchBox } from "../library/chrome";
import { lobbyURL } from "../../lib/play/routes";
import { Button } from "../ui/Button";
import { GamesIcon } from "../ui/icons";
import { useEndOfList } from "../friends/useEndOfList";
import { InboxRow } from "./InboxRow";
import { NewChatSheet } from "./NewChatSheet";

/** پیام‌ها: the chats, newest first, with a search over them (Messages/InboxScreen.swift). A guest gets the gate. */
export function InboxScreen() {
  const services = useServices();
  return services ? <Inbox services={services} /> : null;
}

function Inbox({ services }: { services: Services }) {
  const { messages } = services;
  const { inbox } = messages;
  const account = useAccount();
  const router = useRouter();
  const { rows, phase, query } = useStore(inbox)!;
  const signedIn = useStore(services.session)?.status === "in";
  const pathname = usePathname();
  const [composing, setComposing] = useState(false);
  const shown = inbox.visibleRows;
  const end = useEndOfList(shown.at(-1)?.id, () => void inbox.loadMore());

  useEffect(() => {
    inbox.isVisible = true;
    return () => {
      inbox.isVisible = false;
    };
  }, [inbox]);
  // The inbox is a use of the account: a guest gets the gate, and the list loads after the sign-in.
  useEffect(() => {
    account.require("messages", () => void inbox.load());
  }, [signedIn]);

  const now = new Date();
  return (
    <>
      <header className="dotted-paper sticky top-0 z-20 flex flex-col gap-4 px-[18px] pt-[calc(env(safe-area-inset-top)+6px)] pb-2">
        <div className="flex items-center gap-3">
          <h1 className="flex-1 pt-1 text-[30px] text-ink">پیام‌ها</h1>
          <RoundButton label="بازی با دوست" onClick={() => account.require("games", () => router.push(lobbyURL()))}>
            <GamesIcon size={20} lineWidth={2.2} />
          </RoundButton>
          <button
            type="button"
            aria-label="پیام تازه"
            data-testid="inbox-compose"
            onClick={() => account.require("messages", () => setComposing(true))}
            className="grid size-11 place-items-center rounded-full border-[3px] border-white bg-lapis text-white shadow-[0_2px_8px_rgba(20,17,43,0.22)]"
          >
            <PencilIcon size={20} lineWidth={2.4} />
          </button>
        </div>
        <div {...feedbackPrivate}>
          <SearchBox round value={query} onChange={(value) => inbox.setQuery(value)} placeholder="جستجو بین دوستات" />
        </div>
      </header>
      <div className="flex flex-col gap-4 px-[18px] pt-2 pb-[calc(88px+env(safe-area-inset-bottom)+16px)] lg:pb-8">
        <RequestsRow />
        {!signedIn ? (
          <Button className="self-center" onClick={() => account.require("messages", () => void inbox.load())}>
            {accountFeatures.messages}
          </Button>
        ) : phase.kind === "loading" ? (
          <Busy />
        ) : phase.kind === "failed" ? (
          <div className="flex flex-col items-center gap-2.5">
            <Note>{phase.message}</Note>
            <button type="button" onClick={() => void inbox.load()} className="text-sm font-bold text-lapis">
              دوباره
            </button>
          </div>
        ) : rows.length === 0 ? (
          <Note testId="no-chats">هنوز گفتگویی نداری.</Note>
        ) : shown.length === 0 ? (
          <Note>کسی با این اسم پیدا نشد.</Note>
        ) : (
          <div data-testid="inbox-list" className="rounded-3xl bg-white px-4 py-1 shadow-[0_3px_6px_rgba(20,17,43,0.08)]">
            {shown.map((row, index) => (
              <InboxRow key={row.id} row={row} last={index === shown.length - 1} now={now} active={pathname === `/messages/${row.other.username}`} open={() => messages.chat({ id: row.id, other: row.other })} />
            ))}
            <div ref={end} />
          </div>
        )}
      </div>
      <NewChatSheet services={services} open={composing} onClose={() => setComposing(false)} />
    </>
  );
}
