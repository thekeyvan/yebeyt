"use client";

import { Sheet } from "../ui/Sheet";
import { UsernameStep } from "./UsernameStep";

/** The username step in a sheet, for a signed-in person who has no username yet and uses something that needs an account (Account/AccountGateSheet.swift `AccountPromptSheet`). */
export function UsernameSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      header={(Title) => <Title className="w-full text-start font-title text-[30px] leading-[1.3]">یه نام کاربری انتخاب کن</Title>}
    >
      <UsernameStep onSaved={onSaved} withHeading={false} />
    </Sheet>
  );
}
