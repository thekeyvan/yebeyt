"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { accountServices, type Services } from "../../lib/account/services";
import type { AccountFeature } from "../../lib/account/features";
import { useStore } from "../../lib/library/browser";
import { OnboardingHost } from "../onboarding/OnboardingHost";
import { AccountGateSheet } from "./AccountGateSheet";
import { SyncHost } from "./SyncHost";
import { UsernameSheet } from "./UsernameSheet";

type Account = {
  /**
   * Asks for an account for `feature` (`account.require(.likes) { … }` on iOS): `action` runs when there is an account with a username, after the gate (and
   * the username step) when there is not; «بعداً» drops it. `needed: false` is for what a guest may still do (taking back a like).
   */
  require: (feature: AccountFeature, action?: () => void, options?: { needed?: boolean }) => void;
};

const AccountContext = createContext<Account>({ require: () => {} });

export const useAccount = (): Account => useContext(AccountContext);

/** The one account sheet over every screen (the reader over the tabs included): the gate, or the username step after a sign-in that leaves no username. */
function AccountPrompt({ services }: { services: Services }) {
  const { account } = services;
  const prompt = useStore(account)?.prompt;
  // The feature stays after the gate closes, so the sheet keeps its words while it goes down.
  const [feature, setFeature] = useState<AccountFeature>("likes");
  useEffect(() => {
    if (prompt?.kind === "gate") setFeature(prompt.feature);
  }, [prompt]);
  return (
    <>
      <AccountGateSheet feature={prompt?.kind === "gate" ? prompt.feature : feature} open={prompt?.kind === "gate"} onClose={() => account.dismissPrompt()} account={account} onOutcome={(outcome) => account.afterGate(outcome)} />
      <UsernameSheet open={prompt?.kind === "username"} onClose={() => account.dismissPrompt()} onSaved={() => account.finishPrompt()} />
    </>
  );
}

/** What needs the browser's own storage and the server: made once the page is in the browser. */
function AccountRuntime() {
  const [services, setServices] = useState<Services>();
  useEffect(() => {
    const made = accountServices();
    setServices(made);
    void made.session.restore();
  }, []);
  return services ? (
    <>
      <SyncHost services={services} />
      <AccountPrompt services={services} />
      <OnboardingHost services={services} />
    </>
  ) : null;
}

/** Hosts the account over every screen: the gate and the username step, the sync with the server, and onboarding on the first visit. */
export function AccountProvider({ children }: { children: ReactNode }) {
  const value = useMemo<Account>(() => ({ require: (feature, action = () => {}, options) => accountServices().account.require(feature, action, options) }), []);
  return (
    <AccountContext value={value}>
      {children}
      <AccountRuntime />
    </AccountContext>
  );
}
