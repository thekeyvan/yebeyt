"use client";

import type { ComponentType, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { clip, textLimit } from "../../lib/feedback/types";
import { CloseIcon } from "../ui/icons";

// The pieces the feedback forms share (FeedbackControls.swift).

/** The quiet grey of hints and notes on the feedback boards. */
export const hint = "text-[#8A8698]";

/** The field of a form: a white box with the lapis outline while it has the focus. */
export const field = "w-full rounded-[14px] bg-white px-3.5 text-[14px] text-ink outline-none placeholder:text-[#8A8698] focus:ring-2 focus:ring-lapis";

/** «چی شد؟» with the small hint after it («اگه داره»). */
export function FeedbackLabel({ title, note }: { title: string; note?: string }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span className="text-[13px] font-bold text-ink">{title}</span>
      {note && <span className={cn("text-[11px]", hint)}>{note}</span>}
    </p>
  );
}

/** A box for several lines; the text is cut at the server's limit. */
export function FeedbackTextArea({ value, onChange, minHeight, placeholder, label, testId, disabled }: { value: string; onChange: (text: string) => void; minHeight: number; placeholder?: string; label: string; testId: string; disabled: boolean }) {
  return (
    <textarea
      autoFocus
      value={value}
      onChange={(event) => onChange(clip(event.target.value, textLimit))}
      placeholder={placeholder}
      aria-label={label}
      disabled={disabled}
      data-testid={testId}
      style={{ minHeight }}
      className={cn(field, "block resize-none py-2.5 leading-[1.9]")}
    />
  );
}

/** The board's 44×26 switch, lapis when on. */
export function FeedbackSwitch({ on, onChange, label, disabled, testId }: { on: boolean; onChange: (on: boolean) => void; label: string; disabled: boolean; testId: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} data-testid={testId} onClick={() => onChange(!on)} className={cn("relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-150 disabled:opacity-50 motion-reduce:transition-none", on ? "bg-lapis" : "bg-ring")}>
      <span className={cn("absolute start-[3px] top-[3px] size-5 rounded-full bg-white transition-transform duration-150 motion-reduce:transition-none", on && "ltr:translate-x-[18px] rtl:-translate-x-[18px]")} />
    </button>
  );
}

/** The small red line under a form when sending did not go through. */
export const FailureLine = ({ line }: { line: string }) => (
  <p role="alert" data-testid="feedback-failure" className="text-[12.5px] font-medium text-fire">
    {line}
  </p>
);

/** The round white × of a header. */
export function CloseButton({ onClick, testId }: { onClick: () => void; testId: string }) {
  return (
    <button type="button" aria-label="بستن" data-testid={testId} onClick={onClick} className="grid size-11 shrink-0 place-items-center">
      <span className="grid size-10 place-items-center rounded-full bg-white text-ink shadow-[0_2px_4px_rgba(20,17,43,0.1)]">
        <CloseIcon size={18} lineWidth={2.6} />
      </span>
    </button>
  );
}

/** «تمام» and «بفرست»: the lapis capsule with a white border; dim while there is nothing to do. */
export function CapsuleButton({ onClick, disabled, testId, children }: { onClick: () => void; disabled?: boolean; testId: string; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-testid={testId} className="rounded-full border-[3px] border-white bg-lapis px-4 py-[3px] text-[14px] font-bold text-white shadow-[0_3px_5px_rgba(47,53,245,0.28)] disabled:opacity-40">
      {children}
    </button>
  );
}

/** The top row of a form: ×, the title and «بفرست». */
export function FormHeader({ Title, title, canSend, close, send }: { Title: ComponentType<{ className?: string; children?: ReactNode }>; title: string; canSend: boolean; close: () => void; send: () => void }) {
  return (
    <div className="flex w-full items-center gap-2.5">
      <CloseButton onClick={close} testId="feedback-close" />
      <Title className="flex-1 text-start font-title text-[22px] leading-[1.3] text-ink">{title}</Title>
      <CapsuleButton onClick={send} disabled={!canSend} testId="feedback-send">
        بفرست
      </CapsuleButton>
    </div>
  );
}
