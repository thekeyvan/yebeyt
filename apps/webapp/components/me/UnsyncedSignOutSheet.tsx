"use client";

import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { unsyncedCopy } from "../../lib/account/signOut";

/** The warning when the last sync did not go through: «همه‌ی بیت‌هات هنوز به حسابت نرسیده…» with «خروج» and «بمونم» (Me/Settings/UnsyncedSignOutSheet.swift). */
export function UnsyncedSignOutSheet({ open, onOpenChange, leaving, onLeave }: { open: boolean; onOpenChange: (open: boolean) => void; leaving: boolean; onLeave: () => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={unsyncedCopy.title}>
      <div className="flex w-full gap-3 pt-2">
        <Button variant="ghost" className="flex-1" data-testid="unsynced-stay" onClick={() => onOpenChange(false)}>
          {unsyncedCopy.stay}
        </Button>
        <Button variant="fire" className="flex-1" data-testid="unsynced-leave" disabled={leaving} onClick={onLeave}>
          {unsyncedCopy.leave}
        </Button>
      </div>
    </Sheet>
  );
}
