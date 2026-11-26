"use client";

import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type SegmentOption<T extends string> = { value: T; label: string; leading?: ReactNode };

/**
 * «بیت به بیت / کل شعر» (`pill`: a white capsule, the chosen one lapis), the text sheet's rows (`row`: a light pill with the title above
 * it), the sorts of a section (`divan`: the same on a darker track) and the choices on a white card (`paper`: a capsule on the paper's colour, as the privacy rows): one option is on, as in a radio group drawn as buttons. The behaviour (arrow keys, roles) is UI SDK's; the lapis
 * indicator slides to the chosen one, and stays put under Reduce Motion.
 */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  look,
  disabled,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  label: string;
  look: "pill" | "row" | "divan" | "paper";
  disabled?: boolean;
}) {
  const pill = look === "pill" || look === "paper";
  return (
    <SegmentedControl
      value={value}
      onValueChange={(next) => next && onValueChange(next)}
      aria-label={label}
      disabled={disabled}
      className={cn(
        "relative isolate flex gap-0.5 p-[3px]",
        look === "pill" ? "rounded-pill bg-white shadow-[0_2px_4px_rgba(20,17,43,0.08)]" : look === "paper" ? "rounded-pill bg-paper" : cn("w-full gap-1 rounded-[14px] p-1", look === "divan" ? "bg-track-light" : "bg-paper"),
        disabled && "opacity-40",
      )}
    >
      <SegmentedControlIndicator
        className={cn(
          "absolute -z-10 bg-lapis transition-[left,width] duration-150 motion-reduce:transition-none",
          "top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width)",
          pill ? "rounded-pill" : "rounded-xl",
        )}
      />
      {options.map((option) => (
        <SegmentedControlItem
          key={option.value}
          value={option.value}
          className={cn(
            "flex items-center justify-center gap-1.5 text-[13px] text-ink data-checked:font-bold data-checked:text-white",
            pill ? "rounded-pill px-3.5 py-1.5 font-medium" : "h-[38px] flex-1 rounded-xl font-medium",
          )}
        >
          {option.leading}
          {option.label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}
