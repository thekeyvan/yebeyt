"use client";

import type { ReactNode } from "react";
import type { AccountModel } from "../../lib/account/accountModel";
import type { OnboardingModel } from "../../lib/onboarding/model";
import { onboardingReward } from "../../lib/onboarding/game";
import { persianDigits } from "../../lib/persian";
import { SignInButtons } from "../account/SignInButtons";
import { GameIcon } from "../games/GameIcon";
import { BookmarkIcon, StarIcon } from "../ui/icons";
import { OnbScreen, OnbTopBar, useLargeText } from "./chrome";

function Badge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span aria-hidden className={`grid size-[38px] shrink-0 place-items-center rounded-full border-[3px] border-white shadow-[0_2px_3px_rgba(20,17,43,0.18)] ${color}`}>
      {children}
    </span>
  );
}

function Row({ text, icon }: { text: string; icon: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      {icon}
      <span className="text-sm font-medium text-ink">{text}</span>
    </li>
  );
}

/** «با ادامه، شرایط استفاده و حریم خصوصی رو قبول می‌کنی.» */
function Terms() {
  return (
    <p className="text-center text-[11px] leading-[1.9] text-[#8A8698]">
      با ادامه،{" "}
      <a href="https://yebeyt.com/terms" target="_blank" rel="noreferrer" className="text-lapis">
        شرایط استفاده
      </a>{" "}
      و{" "}
      <a href="https://yebeyt.com/privacy" target="_blank" rel="noreferrer" className="text-lapis">
        حریم خصوصی
      </a>{" "}
      رو قبول می‌کنی.
      <br />
      ایمیلت رو به هیچ‌کس نشون نمی‌دیم.
    </p>
  );
}

/** OnbAccount: «امتیازت رو نگه داریم؟» with what an account gives, Apple and Google, and «فعلاً بدون حساب»; «آفرین! +۵۰» shows when the first game was won (Onboarding/OnbAccountView.swift). */
export function OnbAccount({ onboarding, account }: { onboarding: OnboardingModel; account: AccountModel }) {
  const large = useLargeText();
  const later = (
    <div className="flex flex-col items-center gap-1">
      <button type="button" onClick={() => onboarding.finish()} data-testid="onb-no-account" className="min-h-11 w-full text-sm font-bold text-muted">
        فعلاً بدون حساب
      </button>
      <Terms />
    </div>
  );
  return (
    <OnbScreen
      step="account"
      header={<OnbTopBar step="account" skip={() => onboarding.finish()} />}
      footer={
        <div className="flex flex-col gap-1">
          <SignInButtons account={account} onOutcome={(outcome) => outcome.kind === "signedIn" && onboarding.signedIn(outcome.needsUsername)} />
          {!large && later}
        </div>
      }
    >
      {(compact) => (
        <div className={`flex flex-col ${compact ? "gap-2.5" : "gap-4"}`}>
          <div className="flex flex-col items-center gap-2.5 pt-1.5 text-center">
            {onboarding.gameWon && (
              <p data-testid="onb-reward" className="-rotate-[4deg] rounded-pill border-[5px] border-white bg-amber px-5 pt-2 pb-[3px] font-title text-[30px] leading-[1.2] text-ink shadow-[0_4px_12px_rgba(20,17,43,0.2)]">
                {`آفرین! +${persianDigits(onboardingReward)}`}
              </p>
            )}
            <h1 className="pt-1.5 font-title text-[30px] leading-[1.3] text-ink">امتیازت رو نگه داریم؟</h1>
            <p className="whitespace-pre-line text-[13px] leading-[1.9] text-muted">{"با یه حساب، هر چی جمع می‌کنی مال خودت می‌مونه،\nروی هر گوشی‌ای."}</p>
          </div>
          <ul className="flex flex-col gap-3 rounded-3xl bg-white px-[18px] py-4 shadow-[0_6px_11px_rgba(20,17,43,0.08)]">
            <Row
              text="امتیاز، رشته‌ی روزها و رده‌بندی"
              icon={
                <Badge color="bg-amber">
                  <span className="text-ink">
                    <StarIcon size={18} />
                  </span>
                </Badge>
              }
            />
            <Row text="مشاعره و بازی با دوستات" icon={<GameIcon kind="mosh" size={38} />} />
            <Row
              text="دیوانت روی همه‌ی گوشی‌هات"
              icon={
                <Badge color="bg-lapis">
                  <span className="text-white">
                    <BookmarkIcon size={17} lineWidth={2.2} fill="currentColor" />
                  </span>
                </Badge>
              }
            />
          </ul>
          {large && later}
        </div>
      )}
    </OnbScreen>
  );
}
