"use client";

import { useEffect } from "react";
import type { Services } from "../../lib/account/services";
import { useStore } from "../../lib/library/browser";
import { Screen } from "../shell/Screen";
import { Segmented, type SegmentOption } from "../ui/Segmented";
import { MeCard, MeHeader, RowsCard, SwitchRow } from "./chrome";
import { LockIcon } from "./icons";
import { WithServices } from "./WithServices";

const friendsOrMe: SegmentOption<"friends" | "me">[] = [
  { value: "friends", label: "دوستا" },
  { value: "me", label: "فقط من" },
];
const allOrFriends: SegmentOption<"all" | "friends">[] = [
  { value: "all", label: "همه" },
  { value: "friends", label: "دوستا" },
];

/** A row with the setting's name and its choices as a pill control (the first at the start). */
function Choice<Value extends string>({ title, value, onChange, options, id }: { title: string; value: Value; onChange: (value: Value) => void; options: SegmentOption<Value>[]; id: string }) {
  return (
    <div data-testid={`privacy-${id}`} className="flex items-center gap-2.5 py-3">
      <span className="min-w-0 flex-1 text-sm font-medium leading-[1.7] text-ink">{title}</span>
      <Segmented value={value} onValueChange={onChange} options={options} label={title} look="paper" />
    </div>
  );
}

/** حریم خصوصی: who sees what and who may reach me. Kept in this browser and, with an account, on the server (Me/Privacy/PrivacyScreen.swift). */
export function PrivacyScreen() {
  return <WithServices>{(services) => <Privacy services={services} />}</WithServices>;
}

function Privacy({ services }: { services: Services }) {
  const { privacy } = services;
  const settings = useStore(privacy) ?? privacy.settings;
  const set = privacy.change.bind(privacy);
  // The settings of the account come down when the screen opens, once the session is known (the page may have opened on this screen).
  useEffect(() => void services.session.restore().then(() => privacy.refresh()), [services, privacy]);

  return (
    <Screen header={<MeHeader title="حریم خصوصی" subtitle="خودت انتخاب کن کی چی ببینه." />}>
      <div className="flex flex-col gap-3.5">
        <RowsCard title="دوستات چی ببینن">
          <Choice title="بیت‌هایی که نگه می‌دارم" value={settings.keptVisibility} onChange={(value) => set("keptVisibility", value)} options={friendsOrMe} id="kept" />
          <Choice title="نتیجه‌ی معمای روز" value={settings.dailyVisibility} onChange={(value) => set("dailyVisibility", value)} options={friendsOrMe} id="daily" />
          <SwitchRow title="آنلاین بودنم" on={settings.showOnline} onChange={(on) => set("showOnline", on)} testId="privacy-online" />
          <SwitchRow title="اسمم توی رده‌بندیِ همه" note="توی لیگ خودت همیشه دیده می‌شی" on={settings.inGlobalLeaderboard} onChange={(on) => set("inGlobalLeaderboard", on)} testId="privacy-leaderboard" />
        </RowsCard>
        <RowsCard title="کی می‌تونه…">
          <Choice title="بهم پیام بده" value={settings.messagesFrom} onChange={(value) => set("messagesFrom", value)} options={allOrFriends} id="messages" />
          <Choice title="دعوتم کنه به بازی" value={settings.gameInvitesFrom} onChange={(value) => set("gameInvitesFrom", value)} options={allOrFriends} id="invites" />
        </RowsCard>
        <RowsCard title="بازنشر">
          <SwitchRow title="دوستام بتونن بیت‌هایی که می‌فرستم رو بازنشر کنن" on={settings.allowReposts} onChange={(on) => set("allowReposts", on)} testId="privacy-reposts" />
        </RowsCard>
        <MeCard className="flex items-center gap-3 px-4 py-3.5">
          <span aria-hidden className="grid size-10 shrink-0 -rotate-[8deg] place-items-center rounded-full border-[3px] border-white bg-amber text-ink shadow-[0_2px_6px_rgba(20,17,43,0.22)]">
            <LockIcon size={18} lineWidth={2.4} />
          </span>
          <p className="text-[13px] leading-[2] text-ink">بیت‌هایی که نگه می‌داری رو فقط دوستات می‌بینن، اگه بخوای.</p>
        </MeCard>
      </div>
    </Screen>
  );
}
