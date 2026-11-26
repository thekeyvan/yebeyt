"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { BackButton } from "../library/chrome";

/** The white card of the Me screens: radius 22, a soft shadow (`meCard` in Me/MeControls.swift). */
export function MeCard({ className, ...props }: ComponentProps<"div">) {
  return (
    <div {...props} className={cn("rounded-[22px] bg-white shadow-[0_3px_6px_rgba(20,17,43,0.1)]", className)} />
  );
}

/** A card of settings rows: an optional lapis title, then the rows with a hairline between them. */
export function RowsCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <MeCard role="group" aria-label={title} className="px-4 pt-2.5 pb-1">
      {title && <h2 className="pt-1 pb-0.5 font-ui text-[13px] font-bold text-lapis">{title}</h2>}
      <div className="divide-y divide-chip-border">{children}</div>
    </MeCard>
  );
}

/** The board's switch row: the label at the start, a 50×30 switch at the end (green when on, the knob at the end when on). */
export function SwitchRow({ title, note, on, onChange, testId }: { title: string; note?: string; on: boolean; onChange: (on: boolean) => void; testId: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} data-testid={testId} className="flex w-full items-center gap-2.5 py-3 text-start">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium leading-[1.7] text-ink">{title}</span>
        {note && <span className="text-xs text-muted">{note}</span>}
      </span>
      <span className={cn("flex h-[30px] w-[50px] shrink-0 items-center rounded-full p-[3px] transition-colors duration-150 motion-reduce:transition-none", on ? "justify-end bg-green" : "justify-start bg-ring")}>
        <span className="size-6 rounded-full bg-white shadow-[0_1px_1.5px_rgba(20,17,43,0.3)]" />
      </span>
    </button>
  );
}

/** The header of the pushed Me screens: the back button (to the profile), the title in Lalezar, and a line under or beside it. */
export function MeHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <BackButton fallback="/me" />
      <div className="min-w-0 flex-1">
        <h1 className="text-[30px] leading-[1.3] text-ink">{title}</h1>
        {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
