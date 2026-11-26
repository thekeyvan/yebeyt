"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

type ConfirmSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message?: string;
  /** The red button, the one that does it: «بلاک کن», «حذف کن», «برو بیرون». */
  confirm: string;
  /** The safe button, which keeps things as they are: «نه», «بمون». */
  cancel?: string;
  onConfirm: () => void | Promise<void>;
};

/**
 * The one question asked before something that loses progress or can't be undone (Design/ConfirmSheet.swift): a title,
 * an optional line, the safe button first (so on the right) and the red one that does it. The two buttons are as wide as
 * each other, side by side only while the longer label fits in half the row on one line; otherwise stacked, the safe one on top.
 */
export function ConfirmSheet({ open, onOpenChange, title, message, confirm, cancel = "نه", onConfirm }: ConfirmSheetProps) {
  const [busy, setBusy] = useState(false);

  async function confirmed() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      onOpenChange(false);
    }
  }

  // Each button wants half the row; with a label too long for that, the row wraps and the buttons stack.
  const half = "min-w-max flex-[1_1_calc(50%-7px)] whitespace-nowrap";
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} description={message}>
      <div className="flex w-full flex-wrap gap-3 pt-2">
        <Button variant="ghost" className={half} onClick={() => onOpenChange(false)}>
          {cancel}
        </Button>
        <Button variant="fire" className={half} disabled={busy} onClick={confirmed}>
          {confirm}
        </Button>
      </div>
    </Sheet>
  );
}
