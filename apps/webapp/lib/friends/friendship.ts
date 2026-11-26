import { ApiError, messageOf } from "../account/api";
import type { Friendship } from "./models";

/** What a person can do to a friendship, and the state each action moves it to (shown at once, then the server's answer stands) (Friends/Friendship.swift). */
export type FriendAction = "send" | "cancel" | "accept" | "reject" | "unfriend";

/** The buttons a state shows, the main one first. A friend has none: «دوستین» is a chip, and removing them is in the ⋯ menu. */
export const buttonsOf = (friendship: Friendship): readonly FriendAction[] =>
  ({ none: ["send"], requested: ["cancel"], incoming: ["accept", "reject"], friends: [] } as const)[friendship];

/** The state an action can be done in. */
export const requires = (action: FriendAction): Friendship => ({ send: "none", cancel: "requested", accept: "incoming", reject: "incoming", unfriend: "friends" } as const)[action];

/** The state an action ends in. */
export const resultOf = (action: FriendAction): Friendship => ({ send: "requested", accept: "friends", cancel: "none", reject: "none", unfriend: "none" } as const)[action];

/** Painted as the main (lapis) button; «درخواست فرستادی», «رد» and the rest are grey. */
export const isMain = (action: FriendAction): boolean => action === "send" || action === "accept";

/** Taking a request back and rejecting one ask first; sending and accepting don't, and a friend is removed from the ⋯ menu, which asks on its own. */
export const asksFirst = (action: FriendAction): boolean => action === "cancel" || action === "reject";

/** The words of friend requests: the owner's copy (docs/yebeyt-2.md) and the lead's. */
export const friendCopy = {
  friends: "دوستین",
  requestsTitle: "درخواست‌های دوستی",
  /** The section of requests I sent. */
  sentSection: "فرستادی",
  /** The button of a request I sent, in that section. */
  cancelSent: "لغو",
  confirmUnfriendButton: "حذف کن",
  slowDown: "یه کم بعد دوباره امتحان کن",
  noRequests: "درخواستی نداری.",
  /** The safe button of both questions. */
  keep: "نه",
} as const;

const titles: Record<FriendAction, string> = { send: "درخواست دوستی", cancel: "درخواست فرستادی", accept: "قبول", reject: "رد", unfriend: "حذف از دوستا" };
export const titleOf = (action: FriendAction): string => titles[action];

type Question = { title: string; message?: string; confirm: string };

/** What the sheet asking before `action` says; undefined for an action that doesn't ask. */
export const confirmationFor = (action: FriendAction): Question | undefined =>
  action === "cancel"
    ? { title: "درخواستت رو پس بگیری؟", confirm: "پس بگیر" }
    : action === "reject"
      ? { title: "درخواستش رو رد کنی؟", message: "بهش خبر نمی‌دیم.", confirm: "رد کن" }
      : undefined;

export const confirmUnfriend = (name: string): string => `${name} از دوستات حذف بشه؟`;

/** The line a failed call shows as a toast; the hourly limit on new requests is asked to wait. */
export function friendToast(error: unknown): string {
  return error instanceof ApiError && (error.status === 429 || error.code === "rate_limited") ? friendCopy.slowDown : messageOf(error);
}
