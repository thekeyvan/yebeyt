"use client";

import { useEffect } from "react";
import type { Services } from "../../lib/account/services";
import { useStore } from "../../lib/library/browser";
import { toast } from "../ui/Toast";

/** How long the page may be hidden before its socket is closed: a quick look at another tab keeps it. */
const hiddenMs = 60_000;

/**
 * Keeps the one live socket of this tab (`/v1/live`) open while someone is signed in and the page is in front, closes it after the page has been hidden a while
 * and when they sign out, and forgets the chats then (the phone's `MessagesCenter.setActive`, in RootView). One socket per tab: it lives in the center, which is made once.
 */
export function MessagesHost({ services }: { services: Services }) {
  const { session, messages } = services;
  const signedIn = useStore(session)?.status === "in";

  useEffect(() => {
    messages.onToast = toast;
    return () => {
      messages.onToast = undefined;
    };
  }, [messages]);

  useEffect(() => {
    if (!signedIn) {
      messages.reset();
      return;
    }
    let away: ReturnType<typeof setTimeout> | undefined;
    const change = () => {
      clearTimeout(away);
      if (document.visibilityState === "visible") messages.setActive(true);
      else away = setTimeout(() => messages.setActive(false), hiddenMs);
    };
    change();
    document.addEventListener("visibilitychange", change);
    return () => {
      clearTimeout(away);
      document.removeEventListener("visibilitychange", change);
      messages.setActive(false);
    };
  }, [messages, signedIn]);

  return null;
}
