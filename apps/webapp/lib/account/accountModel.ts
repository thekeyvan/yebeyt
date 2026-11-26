import { ApiError, messageOf, type Api } from "./api";
import type { AccountFeature } from "./features";
import { nameProblem, nameProblemMessage } from "./usernameRules";
import { SignInCanceled } from "./credentials";
import type { Session } from "./session";
import type { GameStats } from "../games/stats";
import { Store } from "../reader/store";

/** What a provider handed back, ready for the server. */
export type Credential =
  | { provider: "apple"; identityToken: string; authorizationCode?: string; nonce: string; redirectUri: string }
  | { provider: "google"; idToken: string };

/** A credential and the name the provider shared (used only to fill in the display name field). */
export type ProviderSignIn = { credential: Credential; name?: string };

/** Where Apple's credential comes from: its popup (Google's comes through its own button, `SignInButtons`). Tests use a fake. */
export type CredentialSource = { apple(): Promise<ProviderSignIn> };

/** What the account sheet over the current screen shows. */
export type Prompt = { kind: "gate"; feature: AccountFeature } | { kind: "username" };

export type Outcome = { kind: "signedIn"; needsUsername: boolean } | { kind: "canceled" } | { kind: "failed"; message: string };

type State = {
  prompt?: Prompt;
  /** The provider of the sign-in just made, for the chip «با اپل وارد شدی». */
  provider?: "apple" | "google";
  /** The name the provider shared (Apple's full name, Google's profile name); only fills the name field. */
  providerName?: string;
  isSigningIn: boolean;
};

/**
 * Signing in and what follows it, for the gate and for onboarding (Account/AccountModel.swift): the provider's sheet, the server, the carry-over of guest
 * progress, the display name and username.
 */
export class AccountModel extends Store<State> {
  private pending?: () => void;
  private isLookingUp = false;

  constructor(
    readonly session: Session,
    private readonly stats: GameStats,
    private readonly credentials: CredentialSource,
    private readonly api: Pick<Api, "putProgress" | "setDisplayName" | "setUsername">,
  ) {
    super({ isSigningIn: false });
  }

  /**
   * Runs `action` when there is an account with a username; shows the gate when there is no account, and the username step when there is an account
   * without one. The action waits and runs when that is done; «بعداً» drops it. `needed: false` is for what a guest may still do (taking back a like).
   */
  require(feature: AccountFeature, action: () => void, { needed = true }: { needed?: boolean } = {}): void {
    if (!needed) return action();
    const { status, user } = this.session.snapshot();
    if (status === "loading" || (status === "in" && !user)) {
      // Signed in, but the user is not loaded yet (a page that has not finished asking): load it first. Taps while that is going on are ignored: only the first waiting action is kept.
      if (this.isLookingUp) return;
      this.isLookingUp = true;
      void this.session.restore().finally(() => {
        this.isLookingUp = false;
        this.decide(feature, action);
      });
    } else {
      this.decide(feature, action);
    }
  }

  private decide(feature: AccountFeature, action: () => void): void {
    const { user } = this.session;
    if (!this.session.isSignedIn) {
      this.pending = action;
      this.update({ prompt: { kind: "gate", feature } });
    } else if (user && user.username === null) {
      this.pending = action;
      this.update({ prompt: { kind: "username" } });
    } else {
      action(); // an account with a username, or one that could not be looked up (no network): the server decides later
    }
  }

  /** The sheet is done: closes it and lets the waiting action go. */
  finishPrompt(): void {
    const action = this.pending;
    this.pending = undefined;
    this.update({ prompt: undefined });
    action?.();
  }

  /** «بعداً» or a swipe down: the waiting action is dropped. */
  dismissPrompt(): void {
    this.pending = undefined;
    this.update({ prompt: undefined });
  }

  /** The Apple popup, then the server. Guest progress goes to the account right after. */
  async signIn(): Promise<Outcome> {
    if (this.snapshot().isSigningIn) return { kind: "canceled" };
    this.update({ isSigningIn: true });
    try {
      return await this.signInWith(await this.credentials.apple());
    } catch (error) {
      return error instanceof SignInCanceled ? { kind: "canceled" } : { kind: "failed", message: messageOf(error) };
    } finally {
      this.update({ isSigningIn: false });
    }
  }

  /** What the provider gave, to the server; then the guest's progress goes to the account (another account's points are not carried over). */
  async signInWith({ credential, name }: ProviderSignIn): Promise<Outcome> {
    const wasBusy = this.snapshot().isSigningIn; // Apple's popup is already counted
    if (!wasBusy) this.update({ isSigningIn: true });
    try {
      const { provider, ...fields } = credential;
      const user = await this.session.signIn(provider, fields);
      this.update({ provider, providerName: name });
      if (this.stats.claim(user.id)) await this.carryOverProgress();
      return { kind: "signedIn", needsUsername: user.username === null };
    } catch (error) {
      return { kind: "failed", message: messageOf(error) };
    } finally {
      if (!wasBusy) this.update({ isSigningIn: false });
    }
  }

  /** The gate's buttons: either goes on to the username or lets the action go. Returns the line to show when it failed. */
  afterGate(outcome: Outcome): string | null {
    switch (outcome.kind) {
      case "signedIn":
        if (outcome.needsUsername) this.update({ prompt: { kind: "username" } });
        else this.finishPrompt();
        return null;
      case "canceled":
        return null;
      case "failed":
        return outcome.message;
    }
  }

  /**
   * «همینه»: saves the display name, then the username (the one that can be refused), so a name that fails leaves nothing half done and a taken username can
   * be fixed and sent again. Returns the line to show when it failed.
   */
  async saveProfile(displayName: string, username: string): Promise<string | null> {
    const name = displayName.trim();
    const problem = nameProblem(name);
    if (problem) return nameProblemMessage[problem];
    try {
      if (name !== "" && name !== this.session.user?.displayName) this.session.update(await this.api.setDisplayName(name));
      this.session.update(await this.api.setUsername(username));
      this.update({ providerName: undefined });
      return null;
    } catch (error) {
      return error instanceof ApiError ? error.persianMessage : messageOf(error);
    }
  }

  /** Guest progress is merged into the account (the server keeps the larger values, so repeating is harmless). A failure is not shown: the points stay here. */
  private async carryOverProgress(): Promise<void> {
    const payload = this.stats.carryOver;
    if (payload.points === 0 && payload.streakDays === 0 && Object.keys(payload.bestByGame).length === 0) return;
    await this.api.putProgress(payload).catch(() => undefined);
  }

  private update(change: Partial<State>): void {
    this.set({ ...this.snapshot(), ...change });
  }
}
