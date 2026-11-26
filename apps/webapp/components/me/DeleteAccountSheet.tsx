"use client";

import { useState } from "react";
import type { Services } from "../../lib/account/services";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

/** «حسابت و همه‌ی چیزهایی که جمع کردی پاک می‌شه. مطمئنی؟» with «پاک کن» and «نه» (Me/Settings/DeleteAccountSheet.swift). A failure is said under the question and nothing changes. */
export function DeleteAccountSheet({ open, onOpenChange, services }: { open: boolean; onOpenChange: (open: boolean) => void; services: Services }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function remove() {
    setBusy(true);
    setError(undefined);
    const problem = await services.deletion.delete();
    setBusy(false);
    if (problem) setError(problem);
    else onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="حسابت و همه‌ی چیزهایی که جمع کردی پاک می‌شه. مطمئنی؟">
      {error && (
        <p role="alert" data-testid="delete-error" className="text-center text-[13px] font-medium text-fire">
          {error}
        </p>
      )}
      <div className="flex w-full gap-3 pt-2">
        <Button variant="ghost" className="flex-1" data-testid="delete-cancel" onClick={() => onOpenChange(false)}>
          نه
        </Button>
        <Button variant="fire" className="flex-1" data-testid="delete-confirm" disabled={busy} onClick={remove}>
          پاک کن
        </Button>
      </div>
    </Sheet>
  );
}
