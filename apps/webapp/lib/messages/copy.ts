import { ApiError, messageOf } from "../account/api";
import { dayNumber } from "../library/date";
import { shortDate } from "../me/divanDays";
import { persianDigits } from "../persian";

/** The words of messages that no board has: the lead's copy, kept in one place (Messages/MessageCopy.swift). */
export const messageCopy = {
  sending: "در حال فرستادن",
  notSent: "نرسید · دوباره",
  /** A send the server refused for good (the chat is closed): nothing to tap. */
  refused: "نرسید",
  couplet: "یه بیت",
  closed: "دیگه نمی‌تونی به این گفتگو پیام بدی",
  slowDown: "یه کم آروم‌تر",
  friendsOnlyDivan: "فقط با دوستات می‌شه دیوان مشترک داشت",
  deletedMessage: "این پیام پاک شد",
  reported: "گزارشت رسید",
  seen: "دیده شد",
  newMessage: "پیام تازه",
  divanOpenFailed: "دیوان مشترک باز نشد",
  divanAddedByMe: "تو یه بیت به دیوان مشترک اضافه کردی",
} as const;

/** «سارا یه بیت به دیوان مشترک اضافه کرد» */
export const divanAdded = (name: string): string => `${name} یه بیت به دیوان مشترک اضافه کرد`;

/** «به دیوان من و سارا اضافه شد» */
export const addedToDivan = (name: string): string => `به دیوان من و ${name} اضافه شد`;

export const gameName = (kind: string | undefined): string => (kind === "mosh" ? "مشاعره" : kind === "duel" ? "بازی رودررو" : "بازی");

/** The line a failed call shows as a toast. A send refused for `messages_closed` is not a toast (the composer says it); `sharedDivan` is for a call that needs a friendship. */
export function messageToast(error: unknown, sharedDivan = false): string {
  if (error instanceof ApiError) {
    if (error.status === 429 || error.code === "rate_limited") return messageCopy.slowDown;
    if (error.code === "messages_closed") return messageCopy.closed;
    if (sharedDivan && error.status === 403) return messageCopy.friendsOnlyDivan;
  }
  return messageOf(error);
}

/** The reasons of `POST /v1/reports`. */
export const reportReasons = [
  { reason: "spam", title: "اسپم" },
  { reason: "abuse", title: "بی‌احترامی" },
  { reason: "other", title: "یه چیز دیگه" },
] as const;

export type ReportReason = (typeof reportReasons)[number]["reason"];

/** Times in chats, in Persian digits; `timeZone` is the device's unless a test gives one. */
export const chatTime = {
  /** «۹:۴۵» (24 hours, minutes with two digits). */
  clock(date: Date, timeZone?: string): string {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(date);
    const part = (type: string) => Number(parts.find((one) => one.type === type)?.value ?? 0);
    return `${persianDigits(part("hour"))}:${persianDigits(Math.floor(part("minute") / 10))}${persianDigits(part("minute") % 10)}`;
  },

  /** The label of a day: «امروز», «دیروز», the weekday up to six days back, then «۲۴ آبان». */
  day(date: Date, now: Date, timeZone?: string): string {
    const days = dayNumber(now, timeZone) - dayNumber(date, timeZone);
    if (days <= 0) return "امروز";
    if (days === 1) return "دیروز";
    if (days <= 6) return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone, weekday: "long" }).format(date);
    return shortDate(date, timeZone);
  },

  /** The inbox's stamp: the time today, else the label of the day (but never «امروز»). */
  stamp: (date: Date, now: Date, timeZone?: string): string => (dayNumber(now, timeZone) === dayNumber(date, timeZone) ? chatTime.clock(date, timeZone) : chatTime.day(date, now, timeZone)),

  /** The time on a card of the shared divan: «امروز», «دیروز», «۳ روز پیش», «هفته‌ی پیش» (up to two weeks), then «۹ مهر». */
  added(date: Date, now: Date, timeZone?: string): string {
    const days = dayNumber(now, timeZone) - dayNumber(date, timeZone);
    if (days <= 0) return "امروز";
    if (days === 1) return "دیروز";
    if (days <= 6) return `${persianDigits(days)} روز پیش`;
    if (days <= 13) return "هفته‌ی پیش";
    return shortDate(date, timeZone);
  },
};

const leagueTiers = ["نوآموز", "بیت‌خوان", "غزل‌باز", "سخن‌دان", "استاد سخن"];

/** «لیگ غزل‌باز»: the tiers 0 to 4 of the weekly leagues, named as the levels. */
export const leagueLine = (tier: number): string | undefined => (leagueTiers[tier] === undefined ? undefined : `لیگ ${leagueTiers[tier]}`);

/** A couplet key as the server and the divan write it: «/hafez/ghazal/sh3#0». */
export function parseCoupletKey(key: string): { path: string; index: number } | undefined {
  const hash = key.lastIndexOf("#");
  const tail = key.slice(hash + 1);
  const path = key.slice(0, hash);
  return hash > 0 && /^\d+$/.test(tail) && path.startsWith("/") && path.length > 1 ? { path, index: Number(tail) } : undefined;
}

/** The longest start of the text that is at most `limit` UTF-16 code units (how the server counts the 1000 and 200), never cutting a letter or an emoji in half. */
export function limited(text: string, limit: number): string {
  let result = "";
  for (const character of text) {
    if (result.length + character.length > limit) break;
    result += character;
  }
  return result;
}
