"use client";

import { Menu, MenuContent, MenuItem, MenuTrigger } from "@ui-sdk/react/menu";
import { useState } from "react";
import { confirmUnfriend, friendCopy, titleOf } from "../../lib/friends/friendship";
import type { PersonModel } from "../../lib/friends/person";
import { useAccount } from "../account/AccountProvider";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { ReportSheet } from "./ReportSheet";

type Asking = "unfriend" | "block" | "report";

const item = "flex min-h-11 w-full cursor-default items-center rounded-xl px-4 text-start text-[15px] font-medium text-ink data-highlighted:bg-paper";

/**
 * The ⋯ menu of a person's page: «حذف از دوستا» (for a friend), «بلاک» and «گزارش», each asking on its own (Friends/PersonScreen.swift `topBar`). They need an account:
 * a guest gets the gate, and the question follows the sign-in. `blocked` runs when the block went through (the page closes).
 */
export function PersonMenu({ model, name, isFriend, unfriend, blocked }: { model: PersonModel; name: string; isFriend: boolean; unfriend: () => Promise<void>; blocked: () => void }) {
  const account = useAccount();
  const [asking, setAsking] = useState<Asking>();

  const open = (which: Asking) => account.require("messages", () => setAsking(which));
  const close = (shown: boolean) => !shown && setAsking(undefined);

  return (
    <>
      <Menu onAction={(value) => open(value as Asking)}>
        <MenuTrigger aria-label="بیشتر" data-testid="person-menu" className="grid size-11 place-items-center rounded-full bg-white shadow-[0_2px_4px_rgba(20,17,43,0.16)]">
          <span aria-hidden className="flex gap-[3px]">
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="size-[4.5px] rounded-full bg-ink" />
            ))}
          </span>
        </MenuTrigger>
        <MenuContent align="start" sideOffset={6} className="z-30 min-w-44 rounded-2xl bg-white p-1.5 shadow-[0_6px_16px_rgba(20,17,43,0.2)] outline-none">
          {isFriend && (
            <MenuItem value="unfriend" data-testid="unfriend-item" className={item}>
              {titleOf("unfriend")}
            </MenuItem>
          )}
          <MenuItem value="block" data-testid="block-item" className={item}>
            بلاک
          </MenuItem>
          <MenuItem value="report" data-testid="report-item" className={item}>
            گزارش
          </MenuItem>
        </MenuContent>
      </Menu>
      <ConfirmSheet open={asking === "unfriend"} onOpenChange={close} title={confirmUnfriend(name)} confirm={friendCopy.confirmUnfriendButton} onConfirm={unfriend} />
      <ConfirmSheet
        open={asking === "block"}
        onOpenChange={close}
        title={`${name} بلاک بشه؟`}
        message="دیگه نمی‌تونه بهت پیام بده یا درخواست دوستی بفرسته."
        confirm="بلاک کن"
        onConfirm={async () => void ((await model.block()) && blocked())}
      />
      <ReportSheet name={name} open={asking === "report"} onOpenChange={close} send={(reason, note) => model.report(reason, note)} />
    </>
  );
}
