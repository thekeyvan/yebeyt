import type { AvatarParts } from "@yebeyt/avatar";
import type { Api, User } from "../account/api";
import type { Session, SessionLike } from "../account/session";
import { readJSON, Store, writeJSON, type RemovableStorage } from "../reader/store";
import { isValidParts, partChips, standardParts } from "./avatarCatalogue";

/** Where the face is kept in localStorage: the phone's names. */
export const avatarKey = "me.avatar";
export const avatarUnsentKey = "me.avatar.unsent";

type AvatarSession = SessionLike & Pick<Session, "update">;

const same = (a: AvatarParts, b: AvatarParts): boolean => partChips.every(({ part }) => a[part] === b[part]);

function load(storage: RemovableStorage): AvatarParts {
  const saved = readJSON(storage, avatarKey);
  const parts = typeof saved === "object" && saved !== null ? (saved as AvatarParts) : undefined;
  return parts && isValidParts(parts) ? parts : standardParts;
}

/**
 * The face: kept in this browser (every guest has one) and, for a signed-in person, on the server (Me/Avatar/AvatarStore.swift). «ذخیره» saves it here at once
 * and sends it in the background. A face that is saved but not yet received by the server is «unsent» (kept here until a send succeeds). When someone signs
 * in or the page opens: an unsent face goes up; otherwise the server's face comes down, so a face changed on another device is not overwritten by an old one here.
 */
export class AvatarStore extends Store<AvatarParts> {
  private lastSend: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly storage: RemovableStorage,
    private readonly session: AvatarSession,
    private readonly api: Pick<Api, "setAvatar">,
  ) {
    super(load(storage));
  }

  get parts(): AvatarParts {
    return this.snapshot();
  }

  get isUnsent(): boolean {
    return this.storage.getItem(avatarUnsentKey) === "1";
  }

  /** Saves the face here and sends it in the background (when signed in). */
  save(next: AvatarParts): void {
    this.keep(next);
    this.storage.setItem(avatarUnsentKey, "1");
    if (this.session.isSignedIn) this.lastSend = this.lastSend.then(() => this.send());
  }

  /** With the user the server knows: an unsent face goes up; else the server's face replaces this browser's. */
  async reconcile(user: User | undefined): Promise<void> {
    if (!user || !this.session.isSignedIn) return;
    await this.lastSend;
    const remote = user.avatar;
    if (this.isUnsent) await this.send();
    else if (remote && isValidParts(remote) && !same(remote, this.parts)) this.keep(remote);
  }

  /** Waits for a send that is on its way (without sending anything new). */
  async settle(): Promise<void> {
    await this.lastSend;
  }

  /** Sends an unsent face now and waits for it (before signing out). */
  async flush(): Promise<void> {
    await this.lastSend;
    if (this.isUnsent && this.session.isSignedIn) await this.send();
  }

  /** After the account is deleted or signed out of. */
  clear(): void {
    this.storage.removeItem(avatarKey);
    this.storage.removeItem(avatarUnsentKey);
    this.set(standardParts);
  }

  private keep(face: AvatarParts): void {
    writeJSON(this.storage, avatarKey, face);
    this.set(face);
  }

  /** Sends the current face; the unsent mark goes away only when the server took it and it is still the current face. */
  private async send(): Promise<boolean> {
    const face = this.parts;
    let user: User;
    try {
      user = await this.api.setAvatar(face);
    } catch {
      return false;
    }
    this.session.update(user);
    if (same(face, this.parts)) this.storage.removeItem(avatarUnsentKey);
    return true;
  }
}
