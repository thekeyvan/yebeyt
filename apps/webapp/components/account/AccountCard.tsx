"use client";

import { useEffect, useState, type ReactNode } from "react";
import { signOutCopy, unsyncedCopy } from "../../lib/account/signOut";
import { useStore } from "../../lib/library/browser";
import { Button } from "../ui/Button";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { Sheet } from "../ui/Sheet";
import { UsernameSheet } from "./UsernameSheet";
import { useServices } from "./useServices";

function Row({ label, value, onClick, testId, tint }: { label: string; value?: string; onClick: () => void; testId: string; tint?: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} className="flex min-h-11 w-full items-center gap-3 py-2.5 text-start">
      <span className={`flex-1 text-sm font-medium ${tint ?? "text-ink"}`}>{label}</span>
      {value && (
        <span dir="auto" className="text-sm text-muted">
          {value}
        </span>
      )}
    </button>
  );
}

const Card = ({ title, children }: { title?: string; children: ReactNode }) => (
  <section className="flex flex-col rounded-3xl bg-white px-[18px] py-3.5 shadow-[0_4px_10px_rgba(20,17,43,0.1)]">
    {title && <h2 className="pb-1 text-[13px] font-bold text-lapis">{title}</h2>}
    {children}
  </section>
);

/**
 * The account's part of the settings (the phone's account card): «ورود با اپل یا گوگل» for a guest; for a signed-in person the name and username (they open the
 * username step) and «خروج از حساب», which first asks, then syncs once more, and warns when something did not reach the account (Me/Settings/SettingsScreen.swift).
 * The rest of the settings, and deleting the account, come with the Me tab (W5).
 */
export function AccountCard() {
  const services = useServices();
  const state = useStore(services?.session);
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState(false);
  // «بیرون برو» was chosen; the sign-out starts once that sheet is gone, so the warning of an unsynced divan can follow it.
  const [chosen, setChosen] = useState(false);
  const [unsynced, setUnsynced] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (asking || !chosen || !services) return;
    setChosen(false);
    setLeaving(true);
    void services.leaving.signOut().then((outcome) => {
      setLeaving(false);
      if (outcome === "unsynced") setUnsynced(true);
    });
  }, [asking, chosen, services]);

  if (!services || !state || state.status === "loading") return null;
  const { account } = services;
  if (state.status !== "in") {
    return (
      <Card>
        <Row label="ورود با اپل یا گوگل" onClick={() => account.require("profile", () => {})} testId="settings-sign-in" />
      </Card>
    );
  }
  const { user } = state;
  return (
    <>
      <Card title="حساب">
        <Row label="اسم" value={user?.displayName ?? account.snapshot().providerName ?? ""} onClick={() => setEditing(true)} testId="settings-name" />
        <Row label="نام کاربری" value={user?.username ? `@${user.username}` : ""} onClick={() => setEditing(true)} testId="settings-username" />
        <Row label="خروج از حساب" onClick={() => !leaving && setAsking(true)} testId="sign-out" />
      </Card>
      <UsernameSheet open={editing} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
      <ConfirmSheet open={asking} onOpenChange={setAsking} title={signOutCopy.title} message={signOutCopy.message} confirm={signOutCopy.confirm} cancel={signOutCopy.stay} onConfirm={() => setChosen(true)} />
      <Sheet open={unsynced} onOpenChange={setUnsynced} title={unsyncedCopy.title}>
        <div className="flex w-full gap-3 pt-2">
          <Button variant="ghost" className="flex-1" data-testid="unsynced-stay" onClick={() => setUnsynced(false)}>
            {unsyncedCopy.stay}
          </Button>
          <Button
            variant="fire"
            className="flex-1"
            data-testid="unsynced-leave"
            disabled={leaving}
            onClick={async () => {
              setLeaving(true);
              await services.leaving.signOut(true);
              setLeaving(false);
              setUnsynced(false);
            }}
          >
            {unsyncedCopy.leave}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
