"use client";

import { cn } from "../../lib/cn";
import { buttonsOf, friendCopy, isMain, titleOf, type FriendAction } from "../../lib/friends/friendship";
import type { Friendship } from "../../lib/friends/models";

/** A small capsule button of a row: lapis for the main action, grey for the quiet one (Friends/FriendParts.swift `FriendButton`). */
export function FriendButton({ title, quiet, busy, onPress, testId }: { title: string; quiet?: boolean; busy?: boolean; onPress: () => void; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={busy}
      data-testid={testId}
      className={cn("h-[38px] shrink-0 rounded-full px-3.5 text-[13px] font-bold", quiet ? "bg-track-light text-muted" : "bg-lapis text-white", busy && "opacity-60")}
    >
      {title}
    </button>
  );
}

const ids: Record<FriendAction, string> = { send: "friend", cancel: "friend", accept: "accept", reject: "reject", unfriend: "unfriend" };

/** What a row shows at its end for the friendship: «درخواست دوستی», «درخواست فرستادی» (tap to cancel), «قبول» with «رد», or the chip «دوستین» for a friend. */
export function FriendControl({ username, friendship, busy, act }: { username: string; friendship: Friendship; busy?: boolean; act: (action: FriendAction) => void }) {
  const buttons = buttonsOf(friendship);
  if (buttons.length === 0) {
    return (
      <span data-testid={`friends-${username}`} className="inline-flex h-[38px] shrink-0 items-center rounded-full bg-track-light px-3.5 text-[13px] font-bold text-muted">
        {friendCopy.friends}
      </span>
    );
  }
  return (
    <div className="flex shrink-0 gap-2">
      {buttons.map((action) => (
        <FriendButton key={action} title={titleOf(action)} quiet={!isMain(action)} busy={busy} onPress={() => act(action)} testId={`${ids[action]}-${username}`} />
      ))}
    </div>
  );
}
