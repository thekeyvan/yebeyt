import { ApiError, messageOf, type Api } from "../account/api";
import { Store } from "../reader/store";
import type { FriendsCenter } from "./center";
import { friendToast, requires, resultOf, type FriendAction } from "./friendship";
import { loaded, loading, nameOf, type Phase, type PublicProfile, type ReportRequest } from "./models";

type State = { profile?: PublicProfile; phase: Phase | { kind: "notFound" }; isBusy: boolean };

/** Why someone is reported: the three the server knows. */
export const reasons: readonly { id: ReportRequest["reason"]; title: string }[] = [
  { id: "spam", title: "اسپم" },
  { id: "abuse", title: "بی‌احترامی" },
  { id: "other", title: "یه چیز دیگه" },
];

/** The server takes 500 code points (not UTF-16 units) of the note. */
export const noteLimit = 500;

export const clipped = (note: string): string => [...note].slice(0, noteLimit).join("");

export const reportSent = "گزارشت رسید";

/** Another person's page (Friends/PersonModel.swift): their public profile, the friendship with them, blocking and reporting. `notify` shows a short message (a failed request, «گزارشت رسید»). */
export class PersonModel extends Store<State> {
  constructor(
    readonly username: string,
    private readonly api: Pick<Api, "profile" | "friendAction" | "block" | "report">,
    private readonly notify: (text: string) => void = () => {},
    private readonly center?: Pick<FriendsCenter, "friendshipChanged" | "blockedPerson">,
  ) {
    super({ phase: loading, isBusy: false });
  }

  get name(): string {
    const { profile } = this.snapshot();
    return profile ? nameOf(profile) : this.username;
  }

  get friendship(): PublicProfile["friendship"] {
    return this.snapshot().profile?.friendship ?? "none";
  }

  async load(): Promise<void> {
    try {
      this.update({ profile: await this.api.profile(this.username), phase: loaded });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) this.update({ phase: { kind: "notFound" } });
      else if (!this.snapshot().profile) this.update({ phase: { kind: "failed", message: messageOf(error) } });
    }
  }

  /** Does `action` to the friendship: the page shows the new state at once and goes back, with a message, when the server refuses. An action that doesn't fit the state does nothing. */
  async perform(action: FriendAction): Promise<void> {
    const { profile, isBusy } = this.snapshot();
    if (!profile || profile.friendship !== requires(action) || isBusy) return;
    this.update({ isBusy: true, profile: { ...profile, friendship: resultOf(action) } });
    try {
      const state = await this.api.friendAction(action, this.username);
      this.update({ profile: { ...this.snapshot().profile!, friendship: state } });
      this.center?.friendshipChanged(this.username, action, state);
      await this.load(); // the friends count, the league and «پیام بده» follow the friendship
    } catch (error) {
      this.update({ profile: { ...this.snapshot().profile!, friendship: requires(action) } });
      this.notify(friendToast(error));
    } finally {
      this.update({ isBusy: false });
    }
  }

  /** «بلاک کن». Returns whether it went through (the page then closes). */
  async block(): Promise<boolean> {
    try {
      await this.api.block(this.username);
      this.center?.blockedPerson(this.username);
      return true;
    } catch (error) {
      this.notify(messageOf(error));
      return false;
    }
  }

  /** Sends the report. Returns whether it went through (the sheet then closes and the message thanks). */
  async report(reason: ReportRequest["reason"], note: string): Promise<boolean> {
    const text = note.trim();
    try {
      await this.api.report({ username: this.username, reason, ...(text === "" ? {} : { note: clipped(text) }) });
      this.notify(reportSent);
      return true;
    } catch (error) {
      this.notify(messageOf(error));
      return false;
    }
  }

  private update(change: Partial<State>): void {
    this.set({ ...this.snapshot(), ...change });
  }
}
