import { cn } from "../../lib/cn";
import type { Badge } from "../../lib/me/badges";
import { BadgeStarIcon } from "./icons";

const fill = { fire: "bg-fire", amber: "bg-amber", lapis: "bg-lapis", green: "bg-green" } as const;

/** A badge sticker: a round coloured sticker with a star, tilted; grey and faded when locked (`BadgeSticker` in Me/Profile/BadgesScreen.swift). */
export function BadgeSticker({ badge, size = 56 }: { badge: Badge; size?: number }) {
  const { earned } = badge;
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full border-4 border-white shadow-[0_2px_8px_rgba(20,17,43,0.18)]",
        earned ? fill[badge.color] : "bg-ring opacity-60",
        earned && badge.color === "amber" ? "text-ink" : earned ? "text-white" : "text-muted",
      )}
      style={{ width: size, height: size, transform: earned ? `rotate(${badge.tilt}deg)` : undefined }}
    >
      <BadgeStarIcon size={(24 * size) / 56} lineWidth={2} fill={earned ? "currentColor" : "none"} />
    </span>
  );
}

/** A badge with its name under it, for the profile's row. */
export function BadgeTile({ badge }: { badge: Badge }) {
  return (
    <li className="flex flex-1 flex-col items-center gap-1.5" data-testid={`badge-${badge.id}`} data-earned={badge.earned}>
      <BadgeSticker badge={badge} />
      <span className={cn("text-center text-[11px] font-bold leading-[1.6]", badge.earned ? "text-ink" : "text-muted")}>{badge.title}</span>
      <span className="sr-only">{badge.earned ? "گرفتی" : "قفله"}</span>
    </li>
  );
}
