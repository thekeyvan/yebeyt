"use client";

import { useEffect, useMemo, useState } from "react";
import type { Services } from "../../lib/account/services";
import { feedbackPrivate } from "../../lib/feedbackPrivate";
import { useStore } from "../../lib/library/browser";
import { chatName, type ChatPerson } from "../../lib/messages/models";
import { SharedDivanAdder, type SharedDivanTarget } from "../../lib/messages/sharedDivanAdder";
import { persianDigits } from "../../lib/persian";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { toast } from "../ui/Toast";
import { ChatFace } from "./ChatFace";

function PersonRow({ person, detail, choose }: { person: ChatPerson; detail?: string; choose: () => void }) {
  return (
    <button type="button" data-testid={`divan-with-${person.username}`} onClick={choose} className="flex w-full items-center gap-3 rounded-[20px] bg-white px-3.5 py-2 text-start shadow-[0_3px_6px_rgba(20,17,43,0.06)]">
      <ChatFace parts={person.avatar} size={44} />
      <span className="flex-1 text-[15px] font-medium text-ink">{chatName(person)}</span>
      {detail && <span className="text-xs text-muted">{detail}</span>}
    </button>
  );
}

function Sheeted({ services, target, open, close }: { services: Services; target: SharedDivanTarget; open: boolean; close: () => void }) {
  const adder = useMemo(() => new SharedDivanAdder(target, services.api), [services, target]);
  const { divans, friends, isLoading, showsFriends, phase, chosen, note, failure } = useStore(adder)!;

  useEffect(() => {
    void adder.load().then(() => {
      if (!adder.person && adder.snapshot().divans.length === 0) void adder.showFriends();
    });
  }, [adder]);
  useEffect(() => {
    if (typeof phase === "object") {
      close();
      toast(phase.done);
    }
  }, [phase]);

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()} title="به دیوان مشترک">
      <div className="flex max-h-[60dvh] w-full flex-col gap-3.5 overflow-y-auto">
        {chosen ? (
          <div className="flex w-full flex-col gap-3.5">
            <div className="flex items-center gap-3">
              <ChatFace parts={chosen.avatar} size={44} />
              <span className="flex-1 text-[15px] font-bold text-ink">{`دیوان من و ${chatName(chosen)}`}</span>
              {!adder.person && (
                <button type="button" onClick={() => adder.choose(undefined)} className="text-[13px] font-bold text-lapis">
                  تغییر
                </button>
              )}
            </div>
            <input
              {...feedbackPrivate}
              data-testid="divan-note"
              value={note}
              onChange={(event) => adder.setNote(event.target.value)}
              aria-label="یه یادداشت (اختیاری)"
              placeholder="یه یادداشت (اختیاری)"
              className="h-12 rounded-full bg-white px-4 text-[15px] text-ink shadow-[0_2px_4px_rgba(20,17,43,0.12)] outline-none placeholder:text-[#8A8698]"
            />
            {failure && (
              <p role="alert" data-testid="sheet-failure" className="text-[13px] font-medium text-fire">
                {failure}
              </p>
            )}
            <Button data-testid="divan-add" disabled={phase === "adding"} onClick={() => void adder.add()}>
              اضافه کن
            </Button>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2">
            {divans.map((divan) => (
              <PersonRow key={divan.id} person={divan.other} detail={`${persianDigits(divan.counts.total)} بیت`} choose={() => adder.choose(divan.other)} />
            ))}
            {showsFriends ? (
              <>
                {divans.length > 0 && friends.length > 0 && <h3 className="pt-1.5 font-ui text-[13px] font-bold text-muted">دوستای دیگه</h3>}
                {friends.map((friend) => (
                  <PersonRow key={friend.username} person={friend} choose={() => adder.choose(friend)} />
                ))}
                {divans.length === 0 && friends.length === 0 && !isLoading && <p className="text-sm text-muted">هنوز دوستی نداری که دیوان مشترک داشته باشی.</p>}
              </>
            ) : (
              <button type="button" data-testid="other-friend" onClick={() => void adder.showFriends()} className="py-2.5 text-start text-sm font-bold text-lapis">
                با یه دوست دیگه
              </button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** The one sheet of «به دیوان مشترک», over everything (the reader included): the reader's hold menu opens it for the couplet it holds (`MessagesCenter.askSharedDivan`) (Messages/SharedDivanSheet.swift). */
export function SharedDivanSheetHost({ services }: { services: Services }) {
  const target = useStore(services.messages)?.sharedTarget;
  // Each opening is a sheet of its own, and what it says stays while it goes down.
  const [shown, setShown] = useState<{ id: number; target: SharedDivanTarget }>();
  useEffect(() => {
    if (target) setShown((before) => ({ id: (before?.id ?? 0) + 1, target }));
  }, [target]);
  return shown && <Sheeted key={shown.id} services={services} target={shown.target} open={target !== undefined} close={() => services.messages.closeSharedDivan()} />;
}
