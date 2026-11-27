"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { signOutCopy } from "../../lib/account/signOut";
import type { Services } from "../../lib/account/services";
import { useStore } from "../../lib/library/browser";
import { useTextSettings } from "../../lib/reader/browser";
import { useAccount } from "../account/AccountProvider";
import { UsernameSheet } from "../account/UsernameSheet";
import { TextSheet } from "../reader/TextSheet";
import { Screen } from "../shell/Screen";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { ChevronLeftIcon } from "../ui/icons";
import { feedbackPrivate } from "../../lib/feedbackPrivate";
import { openFeedback } from "../feedback/center";
import { emailLine, newsCopy, setNews } from "../../lib/me/newsChoice";
import { toast } from "../ui/Toast";
import { MeHeader, RowsCard, SwitchRow } from "./chrome";
import { DeleteAccountSheet } from "./DeleteAccountSheet";
import { UnsyncedSignOutSheet } from "./UnsyncedSignOutSheet";
import { WithServices } from "./WithServices";

const rowClass = "flex min-h-11 w-full items-center gap-2 py-[13px] text-start";

type RowProps = { label: string; value?: string; testId: string; tint?: string; chevron?: boolean; latin?: boolean };

function RowBody({ label, value, tint, chevron = true, latin }: RowProps) {
  return (
    <>
      <span className={`flex-1 text-sm font-medium ${tint ?? "text-ink"}`}>{label}</span>
      {value && (
        <span dir={latin ? "ltr" : "auto"} className="max-w-[50%] truncate text-[13px] text-muted">
          {value}
        </span>
      )}
      {chevron && (
        <span className="text-muted">
          <ChevronLeftIcon size={18} lineWidth={2.4} />
        </span>
      )}
    </>
  );
}

/** The address cut in the middle when it is too long, as on the phone: the head gives way, the last characters (the end of the domain) stay. The full address is the `title`. */
function MiddleTruncated({ text }: { text: string }) {
  const cut = Math.max(0, text.length - 10);
  return (
    <span dir="ltr" title={text} className="flex min-w-0 max-w-[50%] text-[13px] text-muted">
      <span className="truncate">{text.slice(0, cut)}</span>
      <span className="shrink-0 whitespace-pre">{text.slice(cut)}</span>
    </span>
  );
}

/** «ایمیل»: the address (Latin, left to right), not a button; the relay address of Apple shows as «مخفی (اپل)». It is private: the feedback screenshot blanks it. */
function EmailRow({ line }: { line: string }) {
  const hidden = line === newsCopy.hiddenEmail;
  return (
    <div data-testid="settings-email" {...feedbackPrivate} className={rowClass}>
      <span className="flex-1 text-sm font-medium text-ink">{newsCopy.emailTitle}</span>
      {hidden ? <span className="max-w-[50%] truncate text-[13px] text-muted">{line}</span> : <MiddleTruncated text={line} />}
    </div>
  );
}

const Row = ({ onClick, ...props }: RowProps & { onClick: () => void }): ReactNode => (
  <button type="button" onClick={onClick} data-testid={props.testId} className={rowClass}>
    <RowBody {...props} />
  </button>
);

const LinkRow = ({ href, internal, ...props }: RowProps & { href: string; internal?: boolean }): ReactNode =>
  internal ? (
    <Link href={href} data-testid={props.testId} className={rowClass}>
      <RowBody {...props} />
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noopener" data-testid={props.testId} className={rowClass}>
      <RowBody {...props} />
    </a>
  );

/**
 * تنظیمات (Me/Settings/SettingsScreen.swift): a plain list in the app's card style. The account (name, username, the email and the news switch, sign out, delete), the text sheet, privacy, and about. A guest
 * sees «ورود با اپل یا گوگل» instead of the account rows. Left out as they make no sense in a browser: the shake for feedback and the version.
 */
export function SettingsScreen() {
  return <WithServices>{(services) => <Settings services={services} />}</WithServices>;
}

function Settings({ services }: { services: Services }) {
  const account = useAccount();
  const state = useStore(services.session);
  const [settings, updateSettings] = useTextSettings();
  const [editing, setEditing] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [asking, setAsking] = useState(false);
  // «بیرون برو» was chosen; the sign-out starts once that sheet is gone, so the warning of an unsynced divan can follow it.
  const [chosen, setChosen] = useState(false);
  const [unsynced, setUnsynced] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [savingNews, setSavingNews] = useState(false);

  useEffect(() => {
    if (asking || !chosen) return;
    setChosen(false);
    setLeaving(true);
    void services.leaving.signOut().then((outcome) => {
      setLeaving(false);
      if (outcome === "unsynced") setUnsynced(true);
    });
  }, [asking, chosen, services]);

  if (!state || state.status === "loading") return <Screen header={<MeHeader title="تنظیمات" />} />;
  const user = state.user;
  const email = emailLine(user?.email);
  const changeNews = (optIn: boolean) => {
    if (savingNews) return;
    setSavingNews(true);
    void setNews(optIn, services.session, services.api).then((failure) => {
      if (failure) toast(failure);
      setSavingNews(false);
    });
  };
  return (
    <Screen header={<MeHeader title="تنظیمات" />}>
      <div className="flex flex-col gap-3.5">
        {state.status === "in" ? (
          <RowsCard title="حساب">
            <Row label="اسم" value={user?.displayName ?? services.account.snapshot().providerName ?? ""} testId="settings-name" onClick={() => setEditing(true)} />
            <Row label="نام کاربری" value={user?.username ? `@${user.username}` : ""} latin testId="settings-username" onClick={() => setEditing(true)} />
            {email && <EmailRow line={email} />}
            {email && <SwitchRow title={newsCopy.switchTitle} note={newsCopy.switchNote} on={user?.newsOptIn ?? false} onChange={changeNews} busy={savingNews} testId="settings-news" />}
            <Row label="خروج از حساب" chevron={false} testId="sign-out" onClick={() => !leaving && setAsking(true)} />
            <Row label="پاک کردن حساب" chevron={false} tint="text-fire" testId="delete-account" onClick={() => setDeleting(true)} />
          </RowsCard>
        ) : (
          <RowsCard>
            <Row label="ورود با اپل یا گوگل" testId="settings-sign-in" onClick={() => account.require("profile")} />
          </RowsCard>
        )}
        <RowsCard>
          <Row label="متن" testId="settings-text" onClick={() => setTextOpen(true)} />
          <LinkRow label="حریم خصوصی" href="/me/privacy" internal testId="settings-privacy" />
        </RowsCard>
        <RowsCard title="درباره">
          <LinkRow label="شرایط استفاده" href="https://yebeyt.com/terms" testId="terms" />
          <LinkRow label="سیاست حریم خصوصی" href="https://yebeyt.com/privacy" testId="privacy-policy" />
          <Row label="بازخورد" testId="settings-feedback" onClick={openFeedback} />
          <LinkRow label="مجوزها" href="/me/licenses" internal testId="licenses" />
        </RowsCard>
      </div>
      <UsernameSheet open={editing} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
      <TextSheet open={textOpen} onClose={() => setTextOpen(false)} settings={settings} update={updateSettings} />
      <ConfirmSheet open={asking} onOpenChange={setAsking} title={signOutCopy.title} message={signOutCopy.message} confirm={signOutCopy.confirm} cancel={signOutCopy.stay} onConfirm={() => setChosen(true)} />
      <UnsyncedSignOutSheet
        open={unsynced}
        onOpenChange={setUnsynced}
        leaving={leaving}
        onLeave={async () => {
          setLeaving(true);
          await services.leaving.signOut(true);
          setLeaving(false);
          setUnsynced(false);
        }}
      />
      <DeleteAccountSheet open={deleting} onOpenChange={setDeleting} services={services} />
    </Screen>
  );
}
