import { messageOf, type Api } from "./api";
import type { Session } from "./session";
import { clearAccountData, settleAccountData, type AccountData } from "./signOut";

/**
 * «پاک کردن حساب»: asks the server to delete the account and everything stored for it, then signs out here and forgets the account's data (Me/Settings/AccountLeaving.swift
 * `AccountDeletion`). When the server can't do it (Apple's token can't be revoked right now, no network) nothing changes and the person is told.
 */
export class AccountDeletion {
  constructor(
    private readonly session: Pick<Session, "signOut" | "isSignedIn">,
    private readonly api: Pick<Api, "deleteAccount">,
    private readonly data: AccountData,
  ) {}

  /** Returns the line to show when it failed; undefined when the account is gone. */
  async delete(): Promise<string | undefined> {
    try {
      await this.api.deleteAccount();
    } catch (error) {
      return messageOf(error);
    }
    // The account is gone: the sign-in is forgotten at once (the server's answer to the logout does not matter), then whatever was on its way lands before this browser is cleared.
    const told = this.session.signOut();
    await settleAccountData(this.data);
    clearAccountData(this.data);
    await told;
    return undefined;
  }
}
