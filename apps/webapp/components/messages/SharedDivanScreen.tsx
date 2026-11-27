"use client";

import { useEffect, useState } from "react";
import type { Services } from "../../lib/account/services";
import { isUsername } from "../../lib/api/proxy";
import { useStore } from "../../lib/library/browser";
import { messageCopy } from "../../lib/messages/copy";
import { chatName, type SharedDivanItem } from "../../lib/messages/models";
import type { DivanFilter } from "../../lib/messages/sharedDivan";
import { cn } from "../../lib/cn";
import { useAccount } from "../account/AccountProvider";
import { useServices } from "../account/useServices";
import { Busy, Note } from "../friends/chrome";
import { BackButton } from "../library/chrome";
import { LockIcon } from "../me/icons";
import { useAvatarParts } from "../me/useAvatarParts";
import { Screen } from "../shell/Screen";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { toast } from "../ui/Toast";
import { useEndOfList } from "../friends/useEndOfList";
import { ChatFace } from "./ChatFace";
import { CoupletPickerSheet } from "./CoupletPickerSheet";
import { SharedDivanCards } from "./SharedDivanCard";
import { usePoetName } from "./useCouplet";

/** دیوان من و <name>: the couplets two friends keep together (Messages/SharedDivanScreen.swift). It is opened from the chat's header by the person's username. */
export function SharedDivanScreen({ username }: { username: string }) {
  const services = useServices();
  return services && isUsername(username) ? <Divan services={services} username={username} /> : <Screen />;
}

function Divan({ services, username }: { services: Services; username: string }) {
  const account = useAccount();
  const model = services.messages.sharedDivan(username);
  const { divan, filter, phase, counts, poetSlugs, toast: line } = useStore(model)!;
  const signedIn = useStore(services.session)?.status === "in";
  const myFace = useAvatarParts(services);
  const poetName = usePoetName();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<SharedDivanItem>();
  const name = divan ? chatName(divan.other) : username;
  const items = model.visibleItems;

  useEffect(() => {
    model.isVisible = true;
    return () => {
      model.isVisible = false;
    };
  }, [model]);
  useEffect(() => {
    account.require("messages", () => void model.load());
  }, [signedIn]);
  useEffect(() => {
    if (line) toast(line.line);
  }, [line?.serial]);

  const chip = (title: string, value: DivanFilter) => (
    <button key={value} type="button" data-testid={`chip-${value}`} aria-pressed={filter === value} onClick={() => void model.select(value)} className={cn("h-[34px] shrink-0 rounded-full px-[13px] text-[13px]", filter === value ? "bg-ink font-bold text-white" : "bg-white font-medium text-ink")}>
      {title}
    </button>
  );

  return (
    <Screen
      header={
        <div className="flex items-center gap-2.5">
          <BackButton fallback={`/messages/${username}`} />
          <span className="flex">
            <ChatFace parts={myFace} size={42} />
            <span className="-ms-3.5">
              <ChatFace parts={divan?.other.avatar ?? null} size={42} />
            </span>
          </span>
          <div className="min-w-0 flex-1 ps-1">
            <h1 data-testid="divan-title" className="truncate text-[22px] leading-[1.4] text-ink">{`دیوان من و ${name}`}</h1>
            {model.subtitle(name) && (
              <p data-testid="divan-subtitle" className="text-xs text-muted">
                {model.subtitle(name)}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="یه بیت اضافه کن"
            data-testid="add-to-divan"
            onClick={() => account.require("messages", () => setAdding(true))}
            className="grid size-[46px] shrink-0 place-items-center rounded-full border-4 border-white bg-lapis text-2xl text-white shadow-[0_3px_5px_rgba(51,86,255,0.3)]"
          >
            <svg aria-hidden width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3.5 pt-1.5">
        <p className="flex w-fit items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs text-muted">
          <LockIcon size={13} lineWidth={2.4} />
          {`فقط تو و ${name} می‌بینید`}
        </p>
        <div className="-mx-[18px] flex gap-2 overflow-x-auto px-[18px] pb-0.5 [scrollbar-width:none]">
          {chip("همه", "all")}
          {chip(`از ${name}`, "them")}
          {chip("از من", "me")}
          {poetSlugs.map((slug) => chip(poetName(slug), `poet:${slug}`))}
        </div>
        {phase.kind === "loading" ? (
          <Busy />
        ) : phase.kind === "failed" ? (
          <div className="flex flex-col items-start gap-2.5">
            <p className="text-[15px] font-bold text-ink">{messageCopy.divanOpenFailed}</p>
            <Note>{phase.message}</Note>
            <button type="button" onClick={() => void model.load()} className="text-sm font-bold text-lapis">
              دوباره
            </button>
          </div>
        ) : items.length === 0 ? (
          <p data-testid="divan-empty" className="text-sm leading-[2] text-muted">
            هنوز بیتی توی این دیوان نیست. با «+» یکی اضافه کن.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <SharedDivanCards items={items} name={name} otherFace={divan?.other.avatar ?? null} myFace={myFace} like={(item) => void model.toggleLike(item)} askRemove={setRemoving} />
            {model.snapshot().hasMore && <MoreSentinel more={() => void model.loadMore()} last={items.at(-1)?.id} />}
          </div>
        )}
      </div>
      <CoupletPickerSheet open={adding} onClose={() => setAdding(false)} title="یه بیت اضافه کن" action="اضافه کن" choose={(key, note) => void model.add(key, note)} />
      <ConfirmSheet
        open={removing !== undefined}
        onOpenChange={(open) => !open && setRemoving(undefined)}
        title="از دیوان مشترک برداشته بشه؟"
        message={`برای ${name} هم برداشته می‌شه.`}
        confirm="بردار"
        onConfirm={() => void (removing && model.remove(removing))} // at once: the sheet doesn't wait for the server
      />
    </Screen>
  );
}

/** The end of the list is in view: the next page is read. */
function MoreSentinel({ more, last }: { more: () => void; last: string | undefined }) {
  return <div ref={useEndOfList(last, more)} />;
}
