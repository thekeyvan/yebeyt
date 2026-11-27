"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { MessagesIcon } from "../ui/icons";
import { InboxScreen } from "./InboxScreen";

/**
 * پیام‌ها on every width: on a phone the inbox is the page of `/messages` and a chat, a shared divan or the requests take the whole screen over it; from 1024 px the
 * inbox stays on one side and the open screen is beside it (the list and its detail, side by side; with nothing open the detail is empty).
 */
export function MessagesLayout({ children }: { children: ReactNode }) {
  const root = usePathname() === "/messages";
  return (
    <div data-testid="messages-panes" className="mx-auto lg:flex lg:max-w-[1000px] lg:items-start lg:gap-6">
      <section aria-label="پیام‌ها" className={cn("mx-auto max-w-[560px] lg:sticky lg:top-0 lg:mx-0 lg:block lg:h-dvh lg:w-[380px] lg:max-w-none lg:shrink-0 lg:overflow-y-auto", !root && "max-lg:hidden")}>
        <InboxScreen />
      </section>
      <div className={cn("min-w-0 lg:flex-1", root && "max-lg:hidden")}>{root ? <EmptyDetail /> : children}</div>
    </div>
  );
}

/** From 1024 px with no chat open: the detail is an empty paper. */
function EmptyDetail() {
  return (
    <div aria-hidden data-testid="empty-detail" className="grid h-dvh place-items-center text-ring">
      <MessagesIcon size={72} lineWidth={1.6} />
    </div>
  );
}
