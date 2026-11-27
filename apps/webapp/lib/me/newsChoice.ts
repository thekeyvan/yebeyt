import { messageOf, type Api, type User } from "../account/api";
import type { Session } from "../account/session";

/** The settings rows of the email (Account/NewsChoice.swift): the same words as on the phone. */
export const newsCopy = {
  emailTitle: "ایمیل",
  hiddenEmail: "مخفی (اپل)",
  switchTitle: "خبرهای یه بیت رو برام ایمیل کن",
  switchNote: "هر وقت بخوای خاموشش کن",
};

/** What the email row shows: the address, «مخفی (اپل)» for Apple's relay address, undefined (no row) without one. */
export function emailLine(email: string | null | undefined): string | undefined {
  if (!email) return undefined;
  return email.toLowerCase().endsWith("@privaterelay.appleid.com") ? newsCopy.hiddenEmail : email;
}

export type NewsSession = Pick<Session, "user" | "update">;

/**
 * Flips the switch at once, then asks the server; its answer replaces the user, and a failure puts the switch back (nothing else of the user changes).
 * Answers the line to show when the server did not take it, undefined when it did.
 */
export async function setNews(optIn: boolean, session: NewsSession, api: Pick<Api, "setNews">): Promise<string | undefined> {
  const before = session.user;
  if (!before) return messageOf(undefined);
  session.update({ ...before, newsOptIn: optIn });
  try {
    session.update(await api.setNews(optIn));
    return undefined;
  } catch (error) {
    const current: User | undefined = session.user;
    if (current) session.update({ ...current, newsOptIn: before.newsOptIn });
    return messageOf(error);
  }
}
