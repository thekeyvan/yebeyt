"use client";

import { accountFeatures, type AccountFeature } from "../../lib/account/features";
import type { AccountModel, Outcome } from "../../lib/account/accountModel";
import { Sheet } from "../ui/Sheet";
import { SignInButtons } from "./SignInButtons";
import { HeartIcon, MeIcon } from "../ui/icons";

export { accountFeatures, type AccountFeature };

function Icon({ feature }: { feature: AccountFeature }) {
  const look = feature === "likes" ? "bg-magenta" : "bg-lapis";
  return (
    <span aria-hidden className={`grid size-[54px] shrink-0 place-items-center rounded-full border-4 border-white text-white shadow-badge ${look}`}>
      {feature === "likes" ? <HeartIcon size={26} lineWidth={2.2} fill="currentColor" /> : <MeIcon size={26} lineWidth={2.2} />}
    </span>
  );
}

/**
 * AccountGate: the sheet over the current screen that asks for an account the first time a feature needs one (Account/AccountGateSheet.swift).
 * It is reusable: give it the feature, which says why («پسند و بازنشر», «پیام دادن به دوستات»). The Apple and Google buttons sign in through `account`; until
 * a provider's id is set they cannot be pressed, and a line says so.
 */
export function AccountGateSheet({ feature, open, onClose, account, onOutcome = () => {} }: { feature: AccountFeature; open: boolean; onClose: () => void; account?: AccountModel; onOutcome?: (outcome: Outcome) => void }) {
  return (
    <Sheet
      open={open}
      onOpenChange={(open) => !open && onClose()}
      header={(Title) => (
        <div className="flex w-full items-center gap-3">
          <Icon feature={feature} />
          <Title className="whitespace-pre-line pt-[3px] text-start font-title text-2xl leading-[1.2]">{`برای ${accountFeatures[feature]}\nیه حساب لازمه`}</Title>
        </div>
      )}
    >
      <p className="w-full text-[13px] leading-[1.9] text-muted">با اپل یا گوگل، چند ثانیه طول می‌کشه. هر چی تا الان جمع کردی (امتیاز، دیوان، رشته‌ی روزها) هم منتقل می‌شه.</p>
      <SignInButtons account={account} onOutcome={onOutcome} />
      <button type="button" onClick={onClose} className="min-h-11 w-full text-sm font-bold text-muted">
        بعداً
      </button>
    </Sheet>
  );
}
