import type { Api, PrivacySettings } from "../account/api";
import type { SessionLike } from "../account/session";
import { readJSON, Store, writeJSON, type RemovableStorage } from "../reader/store";
import { defaultPrivacy, isEmptyPatch, makePatch, mergePatch, parsePatch, parseSettings, removeSent, type Patch } from "./privacy";

/** Where the settings, and the changes the server has not taken yet, are kept in localStorage: the phone's names. */
export const privacyKey = "me.privacy";
export const privacyUnsentKey = "me.privacy.unsent";

/**
 * The privacy settings: kept in this browser, and with an account also on the server (Me/Privacy/PrivacyStore.swift). A change is saved at once and stays in an
 * «unsent» patch until the server has taken it. When the screen opens, the unsent changes are sent first; the server's settings are taken only when nothing is unsent.
 */
export class PrivacyStore extends Store<PrivacySettings> {
  private unsent: Patch;
  private lastPush: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly storage: RemovableStorage,
    private readonly session: SessionLike,
    private readonly api: Pick<Api, "privacy" | "putPrivacy">,
  ) {
    super(parseSettings(readJSON(storage, privacyKey)));
    this.unsent = parsePatch(readJSON(storage, privacyUnsentKey));
  }

  get settings(): PrivacySettings {
    return this.snapshot();
  }

  get hasUnsentChanges(): boolean {
    return !isEmptyPatch(this.unsent);
  }

  /** Changes one setting: saved at once, then sent to the server in the background. */
  change<Field extends keyof PrivacySettings>(field: Field, value: PrivacySettings[Field]): void {
    const next = { ...this.settings, [field]: value };
    const patch = makePatch(this.settings, next);
    if (isEmptyPatch(patch)) return;
    this.unsent = mergePatch(this.unsent, patch);
    this.keep(next);
    if (this.session.isSignedIn) this.lastPush = this.lastPush.then(() => this.push());
  }

  /** When the screen opens: unsent changes go up first; then, if none are left, the server's settings replace this browser's. Without an account, or offline, nothing changes. */
  async refresh(): Promise<void> {
    if (!this.session.isSignedIn) return;
    await this.flush();
    if (this.hasUnsentChanges) return;
    let remote: PrivacySettings;
    try {
      remote = await this.api.privacy();
    } catch {
      return;
    }
    if (this.hasUnsentChanges) return; // changed while the answer was on its way
    this.keep(parseSettings(remote));
  }

  /** Waits for a send that is on its way (without sending anything new). */
  async settle(): Promise<void> {
    await this.lastPush;
  }

  /** Sends what is unsent and waits for it (before signing out). */
  async flush(): Promise<void> {
    await this.lastPush;
    if (this.session.isSignedIn) await this.push();
  }

  /** After the account is deleted or signed out of: the defaults again. */
  clear(): void {
    this.unsent = {};
    this.storage.removeItem(privacyKey);
    this.storage.removeItem(privacyUnsentKey);
    this.set(defaultPrivacy);
  }

  private async push(): Promise<void> {
    const sending = this.unsent;
    if (isEmptyPatch(sending)) return;
    try {
      await this.api.putPrivacy(sending);
    } catch {
      return;
    }
    this.unsent = removeSent(this.unsent, sending);
    this.save();
  }

  private keep(settings: PrivacySettings): void {
    this.set(settings);
    this.save();
  }

  private save(): void {
    writeJSON(this.storage, privacyKey, this.settings);
    writeJSON(this.storage, privacyUnsentKey, this.unsent);
  }
}
