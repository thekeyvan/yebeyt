"use client";

import { useEffect, useState } from "react";
import { feedbackPrivate } from "../../lib/feedbackPrivate";
import type { PersonShort } from "../../lib/friends/models";
import { plain } from "../../lib/library/normalize";
import { useStore } from "../../lib/library/browser";
import type { ChallengeOffer } from "../../lib/play/challengeOffer";
import { ChallengeSender } from "../../lib/play/challengeModels";
import { playCopy } from "../../lib/play/copy";
import { useServices } from "../account/useServices";
import { FacePerson } from "../friends/FacePerson";
import { PeoplePickSheet } from "../friends/PeoplePickSheet";
import { useAvatarParts } from "../me/useAvatarParts";
import { toast } from "../ui/Toast";
import { ShareLinks } from "./ShareLinks";

/**
 * The card of ChallengeSend: «یکی رو به چالش بکش», the message that goes out as it will look, the ways to share the link and «توی اپ: …» to send it to a friend in the
 * app. The challenge is made on the server when the card first shows (Play/ChallengeSendCard.swift).
 */
export function ChallengeSendCard({ offer }: { offer: ChallengeOffer }) {
  const services = useServices();
  return services ? <Card key={offer.items.join()} offer={offer} services={services} /> : null;
}

function Card({ offer, services }: { offer: ChallengeOffer; services: NonNullable<ReturnType<typeof useServices>> }) {
  const user = useStore(services.session)?.user;
  const name = user?.displayName ?? services.account.snapshot().providerName ?? user?.username ?? "";
  const [sender] = useState(() => new ChallengeSender(offer, services.api, name, (text, username) => services.messages.sendText(text, username)));
  const { phase } = useStore(sender)!;
  const myFace = useAvatarParts(services);
  const [friends, setFriends] = useState<PersonShort[]>([]);
  const [picking, setPicking] = useState(false);

  useEffect(() => void sender.create(), [sender]);
  useEffect(() => {
    let current = true;
    services.api.friends().then(
      (page) => current && setFriends(page.items.filter((friend) => friend.canPlay !== false)),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [services]);

  /** A tap on a way to share waits for the challenge to be made. */
  async function shareable() {
    await sender.create();
    if (!sender.share) toast(playCopy.challengePending);
    return sender.share;
  }

  const shown = friends.slice(0, 3);
  return (
    <div data-testid="challenge-send" className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-3 rounded-[26px] bg-white p-4 shadow-[0_3px_6px_rgba(20,17,43,0.08)]">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[22px] leading-[1.3] text-ink">یکی رو به چالش بکش</h2>
          <p className="text-[12.5px] leading-[1.7] text-muted">همین ۱۰ بیت رو بازی می‌کنه و نتیجه‌ها کنار هم میاد. اپ رو نداره؟ با همین لینک هم می‌تونه بازی کنه.</p>
        </div>
        <div className="relative mt-2 flex flex-col gap-2 rounded-[18px] border-2 border-dashed border-[#E6E1D6] bg-paper px-3.5 pt-3.5 pb-3">
          <span className="absolute end-3.5 -top-3.5 -rotate-[5deg] rounded-pill border-[3px] border-white bg-magenta px-2.5 pt-0.5 font-title text-[13px] leading-[1.5] text-white shadow-[0_2px_6px_rgba(20,17,43,0.2)]">چالش</span>
          <div className="flex items-center gap-2">
            <FacePerson parts={myFace} size={34} />
            <p data-testid="challenge-brag" {...feedbackPrivate} className="flex-1 text-sm font-bold leading-[1.7] text-ink">
              {sender.brag}
            </p>
          </div>
          <p className="text-center font-poem text-[15px] text-muted">{`${plain(offer.first.m1)}…`}</p>
          <div className="flex items-center justify-between text-[11px] text-[#8A8698]">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="flex gap-[3px]">
                <span className="h-[13px] w-[9px] -rotate-[8deg] rounded-[3px] bg-lapis" />
                <span className="h-[13px] w-[9px] rotate-6 rounded-[3px] bg-fire" />
              </span>
              یه بیت
            </span>
            <span dir="ltr" data-testid="challenge-link">
              {sender.linkText}
            </span>
          </div>
        </div>
        {phase.kind === "failed" && (
          <div className="flex items-center">
            <p className="flex-1 text-xs text-fire">{phase.line}</p>
            <button type="button" data-testid="challenge-retry" onClick={() => void sender.create()} className="text-xs font-bold text-lapis">
              دوباره
            </button>
          </div>
        )}
        <ShareLinks labelled prepare={shareable} />
      </div>
      <div className="flex items-center gap-2.5 rounded-[20px] bg-white px-3.5 py-2.5 shadow-[0_2px_4px_rgba(20,17,43,0.06)]">
        <span className="text-[13px] font-bold text-ink">توی اپ:</span>
        <span className="flex -space-x-2.5 rtl:space-x-reverse">
          {shown.map((friend) => (
            <FacePerson key={friend.username} parts={friend.avatar} size={36} />
          ))}
        </span>
        <span data-testid="challenge-friends" className="min-w-0 flex-1 truncate text-xs text-muted">
          {shown.map((friend) => friend.displayName?.trim() || friend.username).join("، ") + (friends.length > 3 ? "…" : "")}
        </span>
        <button type="button" data-testid="challenge-pick" onClick={() => setPicking(true)} className="text-[13px] font-bold text-lapis">
          انتخاب
        </button>
      </div>
      <PeoplePickSheet
        services={services}
        open={picking}
        onClose={() => setPicking(false)}
        title="کی رو به چالش بکشی؟"
        invite
        choose={async (person) => {
          const line = await sender.send(person.username);
          if (line === undefined) toast(playCopy.challengeSentTo(person.displayName?.trim() || person.username));
          return line;
        }}
      />
    </div>
  );
}
