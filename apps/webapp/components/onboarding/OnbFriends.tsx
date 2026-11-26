"use client";

import type { OnboardingModel } from "../../lib/onboarding/model";
import { inviteDisplay, inviteURL } from "../../lib/account/usernameRules";
import { browserEnvironment, send } from "../../lib/reader/send";
import { toast } from "../ui/Toast";
import { OnbButton, OnbHeading, OnbScreen } from "./chrome";

/** OnbFriends: the invite link to send (the board's contacts card can't exist: accounts have no phone numbers). The search for people under it comes with the friends (W6) (Onboarding/OnbFriendsView.swift). */
export function OnbFriends({ onboarding, username }: { onboarding: OnboardingModel; username: string }) {
  return (
    <OnbScreen
      step="friends"
      header={
        <button type="button" onClick={() => onboarding.finish()} data-testid="onb-later" className="min-h-11 text-[13px] font-bold text-[#8A8698]">
          بعداً
        </button>
      }
      footer={
        <OnbButton onClick={() => onboarding.finish()} testId="onb-home">
          بریم خونه
        </OnbButton>
      }
    >
      {(compact) => (
        <div className={`flex flex-col ${compact ? "gap-2.5" : "gap-4"}`}>
          <OnbHeading title="دوستات رو پیدا کن" text="شعر با رفیق قشنگ‌تره. هر کی رو پیدا کنی، بیت‌هایی که به اشتراک می‌ذاره توی خونه‌ت میاد." />
          <button
            type="button"
            onClick={() => void send(inviteURL(username), browserEnvironment(), () => toast("کپی شد"))}
            data-testid="onb-invite"
            className="flex min-h-11 items-center gap-3 rounded-[22px] bg-white px-4 py-3.5 text-start shadow-[0_6px_11px_rgba(20,17,43,0.08)]"
          >
            <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full border-[3px] border-white bg-amber text-ink shadow-[0_2px_3px_rgba(20,17,43,0.18)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
              </svg>
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-bold text-ink">لینک دعوتت رو بفرست</span>
              <span dir="ltr" className="text-start text-xs text-lapis">
                {inviteDisplay(username)}
              </span>
            </span>
          </button>
        </div>
      )}
    </OnbScreen>
  );
}
