import type { ReactNode } from "react";
import { persianDigits } from "../../lib/persian";
import { FlameIcon, StarIcon } from "./icons";

type BadgeProps =
  | { kind: "streak"; value: number }
  | { kind: "points"; value: number }
  | { kind: "correct" }
  | { kind: "decorative"; children: ReactNode };

const base = "inline-flex items-center gap-1 rounded-pill border-badge border-white px-[11px] py-[3px] font-bold shadow-badge";

/** Small pill stickers (Design/Badge.swift): streak (fire), points (amber), correct (green) and a decorative tilted one (magenta). */
export function Badge(props: BadgeProps) {
  switch (props.kind) {
    case "streak":
      return (
        <span className={`${base} bg-fire text-[14px] text-white`}>
          <FlameIcon />
          {persianDigits(props.value)}
        </span>
      );
    case "points":
      return (
        <span className={`${base} bg-amber text-[14px] text-ink`}>
          <StarIcon />
          {persianDigits(props.value, { grouped: true })}
        </span>
      );
    case "correct":
      return <span className={`${base} bg-green text-[13px] text-ink`}>درست بود!</span>;
    case "decorative":
      return <span className={`${base} rotate-(--tilt-decorative) bg-magenta text-[13px] text-white`}>{props.children}</span>;
  }
}
