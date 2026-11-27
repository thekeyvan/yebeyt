import { GamesIcon } from "../ui/icons";

/** The little icons of the quick actions (Messages/ChatScreen.swift `quickActions`): two couplet bars, the two arrows of مشاعره, the games, and today's three tiles. */
export const CoupletIcons = {
  Pair: () => (
    <span aria-hidden className="flex gap-0.5">
      <span className="h-3 w-2 rounded-[3px] bg-lapis" />
      <span className="h-3 w-2 rounded-[3px] bg-fire" />
    </span>
  ),
  Arrows: () => (
    <svg aria-hidden width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--color-amber)" strokeWidth={1.73} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h11l-3-3M20 17H9l3 3" />
    </svg>
  ),
  Games: () => (
    <span aria-hidden className="text-lapis">
      <GamesIcon size={16} lineWidth={2.2} />
    </span>
  ),
  Daily: () => (
    <span aria-hidden className="flex gap-0.5">
      <span className="h-[9px] w-[7px] rounded-[2px] bg-green" />
      <span className="h-[9px] w-[7px] rounded-[2px] bg-amber" />
      <span className="h-[9px] w-[7px] rounded-[2px] bg-track-light" />
    </span>
  ),
};
