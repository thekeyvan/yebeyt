"use client";

import { useState, type ReactNode } from "react";
import type { ChatModel } from "../../lib/messages/chat";
import { reportReasons } from "../../lib/messages/copy";
import type { Message } from "../../lib/messages/models";
import { Button } from "../ui/Button";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { Sheet } from "../ui/Sheet";

type Target = { kind: "delete"; message: Message } | { kind: "report"; message: Message } | { kind: "discard"; clientId: string };

/**
 * What a long press (or right click, or the menu key) on a message does: the phone's context menu has one item, so the web asks that question at once. «پاک کن» on a
 * message of mine, «گزارش» on theirs (a choice of the reason), and on a send that failed «پاک کن» takes it out of the list. `sheets` go in the page.
 */
export function useMessageActions(chat: ChatModel): { holdMessage: (message: Message) => void; holdPending: (clientId: string) => void; sheets: ReactNode } {
  const [target, setTarget] = useState<Target>();
  // The question stays after its sheet closes, so the sheet keeps its words while it goes down.
  const [last, setLast] = useState<Target>();
  const ask = (next: Target) => {
    setLast(next);
    setTarget(next);
  };
  const close = (open: boolean) => !open && setTarget(undefined);

  const deleting = last?.kind === "delete" || last?.kind === "discard" ? last : undefined;
  return {
    holdMessage: (message) => ask({ kind: message.fromMe ? "delete" : "report", message }),
    holdPending: (clientId) => ask({ kind: "discard", clientId }),
    sheets: (
      <>
        {deleting && (
          <ConfirmSheet
            open={target?.kind === "delete" || target?.kind === "discard"}
            onOpenChange={close}
            title="این پیام پاک بشه؟"
            confirm="پاک کن"
            onConfirm={() => (deleting.kind === "delete" ? chat.delete(deleting.message) : chat.discard(deleting.clientId))}
          />
        )}
        <Sheet open={target?.kind === "report"} onOpenChange={close} title="چرا گزارشش می‌کنی؟">
          <div className="flex w-full flex-col gap-2.5">
            {reportReasons.map(({ reason, title }) => (
              <Button
                key={reason}
                variant="ghost"
                data-testid={`reason-${reason}`}
                onClick={() => {
                  if (last?.kind === "report") void chat.report(last.message, reason);
                  setTarget(undefined);
                }}
              >
                {title}
              </Button>
            ))}
            <button type="button" onClick={() => setTarget(undefined)} className="min-h-11 text-sm font-bold text-muted">
              بیخیال
            </button>
          </div>
        </Sheet>
      </>
    ),
  };
}
