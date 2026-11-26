"use client";

import { useState } from "react";
import { cn } from "../../lib/cn";
import { reasons } from "../../lib/friends/person";
import type { ReportRequest } from "../../lib/friends/models";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

/** «گزارش»: a reason, an optional note, and send (Friends/PersonScreen.swift `ReportSheet`). `send` returns whether the report went through; the sheet closes then. */
export function ReportSheet({ name, open, onOpenChange, send }: { name: string; open: boolean; onOpenChange: (open: boolean) => void; send: (reason: ReportRequest["reason"], note: string) => Promise<boolean> }) {
  const [reason, setReason] = useState<ReportRequest["reason"]>("spam");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      if (await send(reason, note)) {
        onOpenChange(false);
        setNote("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`گزارش ${name}`}>
      <div role="radiogroup" aria-label="دلیل" className="flex gap-2">
        {reasons.map(({ id, title }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={reason === id}
            data-testid={`reason-${id}`}
            onClick={() => setReason(id)}
            className={cn("rounded-full px-3 py-2 text-[13px]", reason === id ? "bg-lapis font-bold text-white" : "bg-paper font-medium text-ink")}
          >
            {title}
          </button>
        ))}
      </div>
      <textarea
        data-testid="report-note"
        aria-label="اگه خواستی بیشتر بگو (اختیاری)"
        placeholder="اگه خواستی بیشتر بگو (اختیاری)"
        value={note}
        rows={3}
        onChange={(event) => setNote(event.target.value)}
        className="block w-full resize-none rounded-[14px] bg-paper p-3 text-sm text-ink placeholder:text-[#8A8698]"
      />
      <Button className="w-full" disabled={busy} onClick={() => void submit()} data-testid="report-send">
        بفرست
      </Button>
    </Sheet>
  );
}
