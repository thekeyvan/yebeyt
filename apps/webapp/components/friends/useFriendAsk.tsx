"use client";

import { useState, type ReactNode } from "react";
import { asksFirst, confirmationFor, friendCopy, type FriendAction } from "../../lib/friends/friendship";
import { useAccount } from "../account/AccountProvider";
import { ConfirmSheet } from "../ui/ConfirmSheet";

type Asked = { action: FriendAction; username: string };

/**
 * What a tap on a friend button does: it needs an account (the gate opens, and the action goes ahead after the sign-in), and taking a request back and
 * rejecting one ask first («درخواستت رو پس بگیری؟», «درخواستش رو رد کنی؟»), as everywhere the buttons are (Friends/FriendParts.swift `askingBeforeFriendAction`).
 * `sheet` goes in the page; `ask` is what a button calls.
 */
export function useFriendAsk(perform: (action: FriendAction, username: string) => void | Promise<void>): { ask: (action: FriendAction, username: string) => void; sheet: ReactNode } {
  const account = useAccount();
  const [asked, setAsked] = useState<Asked>();
  // The words stay after the sheet closes, so it keeps them while it goes down.
  const [last, setLast] = useState<Asked>();
  const words = last && confirmationFor(last.action);

  function ask(action: FriendAction, username: string) {
    account.require("messages", () => {
      if (!asksFirst(action)) return void perform(action, username);
      setLast({ action, username });
      setAsked({ action, username });
    });
  }

  return {
    ask,
    sheet: words && last && (
      <ConfirmSheet open={asked !== undefined} onOpenChange={(open) => !open && setAsked(undefined)} title={words.title} message={words.message} confirm={words.confirm} cancel={friendCopy.keep} onConfirm={() => perform(last.action, last.username)} />
    ),
  };
}
