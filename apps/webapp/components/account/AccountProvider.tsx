"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { AccountGateSheet, type AccountFeature } from "./AccountGateSheet";

type Account = {
  /** Asks for an account for `feature` (`account.require(.likes)` on iOS): until W4 brings the sign-in, that is the gate. */
  require: (feature: AccountFeature) => void;
};

const AccountContext = createContext<Account>({ require: () => {} });

export const useAccount = (): Account => useContext(AccountContext);

/** Hosts the one account gate over every screen, the reader over the tabs included. */
export function AccountProvider({ children }: { children: ReactNode }) {
  // The feature stays after the gate closes, so the sheet keeps its words while it goes down.
  const [feature, setFeature] = useState<AccountFeature>("likes");
  const [open, setOpen] = useState(false);
  const require = (next: AccountFeature) => {
    setFeature(next);
    setOpen(true);
  };
  return (
    <AccountContext value={{ require }}>
      {children}
      <AccountGateSheet feature={feature} open={open} onClose={() => setOpen(false)} />
    </AccountContext>
  );
}
