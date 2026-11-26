"use client";

import { Sheet } from "../ui/Sheet";
import { HeartIcon, MeIcon } from "../ui/icons";

/** What needs an account: the first use of it shows the account gate (Account/AccountModel.swift). */
export const accountFeatures = {
  likes: "پسند و بازنشر",
  messages: "پیام دادن به دوستات",
  invite: "دعوت دوستات",
  profile: "همگام کردن دیوان و امتیازهات",
  leaderboard: "دیدن رده‌بندی",
  games: "مشاعره با دوستات",
} as const;

export type AccountFeature = keyof typeof accountFeatures;

function Icon({ feature }: { feature: AccountFeature }) {
  const look = feature === "likes" ? "bg-magenta" : "bg-lapis";
  return (
    <span aria-hidden className={`grid size-[54px] shrink-0 place-items-center rounded-full border-4 border-white text-white shadow-badge ${look}`}>
      {feature === "likes" ? <HeartIcon size={26} lineWidth={2.2} fill="currentColor" /> : <MeIcon size={26} lineWidth={2.2} />}
    </span>
  );
}

/** The Apple and Google marks, drawn from the boards' SVG paths (24×24 box). They are the only brand art in the app. */
function AppleMark() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.37 12.6c-.02-2.07 1.69-3.07 1.77-3.12-.96-1.41-2.46-1.6-3-1.62-1.27-.13-2.49.75-3.13.75-.65 0-1.65-.73-2.71-.71-1.39.02-2.68.81-3.4 2.06-1.45 2.52-.37 6.25 1.04 8.29.69 1 1.51 2.12 2.59 2.08 1.04-.04 1.43-.67 2.69-.67 1.25 0 1.61.67 2.71.65 1.12-.02 1.83-1.02 2.51-2.02.79-1.16 1.12-2.28 1.14-2.34-.03-.01-2.18-.84-2.21-3.35zM14.3 6.5c.57-.69.96-1.65.85-2.6-.82.03-1.82.55-2.41 1.24-.53.61-.99 1.59-.87 2.53.92.07 1.85-.47 2.43-1.17z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.5 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.9c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

/**
 * AccountGate: the sheet over the current screen that asks for an account the first time a feature needs one (Account/AccountGateSheet.swift).
 * It is reusable: give it the feature, which says why («پسند و بازنشر», «پیام دادن به دوستات»). Until W4 wires the sign-in, the Apple and Google
 * buttons are there but cannot be pressed, and a line says so.
 */
export function AccountGateSheet({ feature, open, onClose }: { feature: AccountFeature; open: boolean; onClose: () => void }) {
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
      <div className="flex w-full flex-col gap-2.5">
        <button type="button" disabled className="flex h-[54px] items-center justify-center gap-2.5 rounded-2xl bg-black text-base font-bold text-white disabled:opacity-60">
          <AppleMark />
          ادامه با اپل
        </button>
        <button type="button" disabled className="flex h-[54px] items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-[#DADCE0] bg-white text-base font-bold text-ink disabled:opacity-60">
          <GoogleMark />
          ادامه با گوگل
        </button>
        <p className="text-center text-xs font-medium text-muted">ورود روی وب به‌زودی</p>
      </div>
      <button type="button" onClick={onClose} className="min-h-9 w-full text-sm font-bold text-muted">
        بعداً
      </button>
    </Sheet>
  );
}
