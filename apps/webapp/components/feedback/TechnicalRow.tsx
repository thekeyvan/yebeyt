"use client";

import { technicalRows, type TechnicalInfo } from "../../lib/feedback/technical";
import { cn } from "../../lib/cn";
import { ChevronDownIcon } from "../ui/icons";
import { hint } from "./controls";

/** «اطلاعات فنی · ببین چیه»: one collapsed row; opened, it lists exactly what is sent (TechnicalInfo.rows). */
export function TechnicalRow({ info, open, toggle }: { info: TechnicalInfo; open: boolean; toggle: () => void }) {
  return (
    <div className="flex flex-col gap-2 border-t border-dashed border-[#E6E1D6] pt-2">
      <button type="button" aria-expanded={open} data-testid="feedback-technical-toggle" onClick={toggle} className="flex w-full items-center gap-2.5 text-start">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] font-medium text-ink">اطلاعات فنی</span>
          <span className={cn("text-[11.5px]", hint)}>همون لحظه، کارهای قبلش، خطاها، گوشی</span>
        </span>
        <span className="text-xs font-bold text-lapis">{open ? "ببند" : "ببین چیه"}</span>
        <span className={cn(hint, "transition-transform duration-150 motion-reduce:transition-none", open && "rotate-180")}>
          <ChevronDownIcon size={14} lineWidth={2.6} />
        </span>
      </button>
      {open && (
        <dl data-testid="feedback-technical-rows" className="flex flex-col gap-1.5">
          {technicalRows(info).map((row) => (
            <div key={row.label} className="flex items-baseline gap-2">
              <dt className={cn("w-24 shrink-0 text-xs", hint)}>{row.label}</dt>
              <dd dir={row.label === "بیت" ? "ltr" : undefined} className="min-w-0 flex-1 break-words text-start text-xs font-medium text-ink">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
