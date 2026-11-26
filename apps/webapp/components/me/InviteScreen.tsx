"use client";

import { useEffect, useState } from "react";
import type { Services } from "../../lib/account/services";
import { useStore } from "../../lib/library/browser";
import { inviteLink, inviteMessage, inviteOpener, inviteTones, type InviteTone } from "../../lib/me/invite";
import { useAccount } from "../account/AccountProvider";
import { Screen } from "../shell/Screen";
import { Segmented } from "../ui/Segmented";
import { MeCard, MeHeader } from "./chrome";
import { WriteIcon } from "./icons";
import { ShareRow } from "./ShareRow";
import { WithServices } from "./WithServices";

/** The two little cards tilted in the hero (`miniCard`): a white one with a lapis bar, a fire one with a white bar. */
function MiniCard({ fill, bar, tilt }: { fill: string; bar: string; tilt: number }) {
  return (
    <span aria-hidden className={`grid h-[50px] w-[34px] place-items-center rounded-[9px] border-4 border-white shadow-[0_3px_8px_rgba(20,17,43,0.2)] ${fill}`} style={{ transform: `rotate(${tilt}deg)` }}>
      <span className={`h-[5px] w-[18px] rounded-[3px] ${bar}`} />
    </span>
  );
}

/** دوستاتو بیار: the invite text (a tone preset, or written by hand), the personal link, and the ways to send it (Me/Invite/InviteScreen.swift). It needs an account (the link has the username), so the gate opens first. */
export function InviteScreen() {
  return <WithServices>{(services) => <Invite services={services} />}</WithServices>;
}

function Invite({ services }: { services: Services }) {
  const account = useAccount();
  const state = useStore(services.session);
  const username = state?.user?.username ?? undefined;
  const [tone, setTone] = useState<InviteTone | "">("friendly");
  const [text, setText] = useState<string>(inviteTones[0].body);
  const [writing, setWriting] = useState(false);
  const link = username ? inviteLink.display(username) : "yebeyt.com";
  const ready = state?.status !== "loading";

  // The link has the username: a guest gets the gate, a new account its username step.
  useEffect(() => {
    if (ready) account.require("invite");
  }, [ready]);

  function choose(next: InviteTone | "") {
    if (next === "") return;
    setTone(next);
    setText(inviteTones.find((item) => item.id === next)!.body);
    setWriting(false);
  }

  return (
    <Screen header={<MeHeader title="دوستاتو بیار" />}>
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-3.5 rounded-[26px] bg-lapis p-[18px] shadow-[0_6px_8px_rgba(47,53,245,0.25)]">
          <h2 className="flex-1 whitespace-pre-line text-[26px] leading-[1.15] text-white">{"شعر با رفیق\nقشنگ‌تره"}</h2>
          <span aria-hidden className="flex -rotate-[8deg] gap-1.5">
            <MiniCard fill="bg-white" bar="bg-lapis" tilt={0} />
            <MiniCard fill="bg-fire" bar="bg-white" tilt={10} />
          </span>
        </div>
        <MeCard className="flex flex-col gap-2.5 rounded-3xl px-4 py-3.5">
          <div className="flex items-center">
            <h2 className="flex-1 font-ui text-[13px] font-bold text-ink">متن دعوت</h2>
            <button
              type="button"
              data-testid="invite-write"
              aria-pressed={writing}
              onClick={() => {
                setWriting(!writing);
                setTone("");
              }}
              className="flex items-center gap-1 text-xs font-bold text-lapis"
            >
              <WriteIcon size={14} lineWidth={2.4} />
              خودم بنویسم
            </button>
          </div>
          <Segmented value={tone} onValueChange={choose} options={inviteTones.map(({ id, title }) => ({ value: id, label: title }))} label="لحن" look="row" />
          <div className="rounded-2xl bg-board-paper px-3.5 py-3 text-sm leading-[2.1] text-ink">
            {writing ? (
              <textarea
                data-testid="invite-text"
                aria-label="متن دعوت"
                value={text}
                autoFocus
                rows={4}
                onChange={(event) => setText(event.target.value)}
                className="block w-full resize-none rounded-md bg-transparent text-sm leading-[2.1]"
              />
            ) : (
              <p data-testid="invite-body">{text}</p>
            )}
            <p className="mt-0.5 font-bold">«{inviteOpener}»</p>
            <p data-testid="invite-link" dir="ltr" className="text-end font-bold text-lapis">
              {link}
            </p>
          </div>
          <ShareRow payload={username ? { text: inviteMessage(text, link), url: inviteLink.url(username) } : undefined} link={link} />
        </MeCard>
      </div>
    </Screen>
  );
}
