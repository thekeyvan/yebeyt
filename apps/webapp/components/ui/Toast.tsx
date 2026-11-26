"use client";

import { Toast, ToastAction, ToastRegion, ToastTitle, createToaster } from "@ui-sdk/react/toast";
import { motion } from "motion/react";
import { bouncy, toastArrival, useVariant } from "../../lib/motion";
import "./toast.css";

const toaster = createToaster();

/** «برگردون»: the way back a toast offers for something done at once. */
export type ToastUndo = { run: () => void; label?: string };

/** Says `text` for a moment: 2.5 seconds, and 5 with an undo so there is time to tap it (as `ToastTiming` on iOS). */
export function toast(text: string, undo?: ToastUndo): void {
  toaster(text, {
    duration: undo ? 5000 : 2500,
    action: undo && { label: undo.label ?? "برگردون", onAction: undo.run },
  });
}

/** Where the toasts show; put it once in the page, after the content. */
export function ToastHost() {
  const arrival = toastArrival(useVariant());
  return (
    <ToastRegion toaster={toaster} side="bottom" align="center" maxVisible={1} aria-label="اعلان‌ها" pendingAnnouncement="یه لحظه…">
      {() => (
        <Toast>
          <motion.div
            initial={arrival}
            animate={{ y: 0, scale: 1 }}
            transition={bouncy}
            className="flex h-full items-center justify-center gap-3.5 px-4"
          >
            <ToastTitle />
            <ToastAction className="py-2 text-[13px] font-bold underline" />
          </motion.div>
        </Toast>
      )}
    </ToastRegion>
  );
}
