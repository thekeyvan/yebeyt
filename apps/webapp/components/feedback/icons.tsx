import type { ReactNode } from "react";
import type { FeedbackType } from "../../lib/feedback/types";
import { IconBox } from "../ui/IconBox";
import { GamesIcon, HeartIcon } from "../ui/icons";

// The icons of the feedback boards (FeedbackIcons.swift): 24×24 box, never mirrored.

/** باگ دیدم */
const BugIcon = ({ size, lineWidth }: { size: number; lineWidth: number }) => (
  <IconBox size={size} lineWidth={lineWidth}>
    <path d="M7 13a5 5 0 0 1 10 0v2a5 5 0 0 1-10 0zM9 8a3 3 0 0 1 6 0M4 12h3M17 12h3M4.5 7.5l2.8 2M19.5 7.5l-2.8 2M4.5 17.5l2.8-1.5M19.5 17.5l-2.8-1.5M12 12v6" />
  </IconBox>
);

/** یه ایده دارم (a light bulb) */
const IdeaIcon = ({ size, lineWidth }: { size: number; lineWidth: number }) => (
  <IconBox size={size} lineWidth={lineWidth}>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
  </IconBox>
);

/** یه جاش اذیتم کرد (a speech bubble with an exclamation mark) */
const ComplaintIcon = ({ size, lineWidth }: { size: number; lineWidth: number }) => (
  <IconBox size={size} lineWidth={lineWidth}>
    <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM12 8.5V12M12 14.6v.1" />
  </IconBox>
);

/** «دوباره انجامش بده، ما فیلم می‌گیریم»: a record button, a ring with a filled dot. */
export const RecordGlyph = ({ size }: { size: number }) => (
  <IconBox size={size} lineWidth={2.4}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.5" fill="currentColor" />
  </IconBox>
);

/** The colour of the round icon on the sheet, and the icon (white on it, ink on the amber one). */
const looks: Record<FeedbackType, { tint: string; icon: ReactNode }> = {
  bug: { tint: "bg-fire text-white", icon: <BugIcon size={22} lineWidth={2.3} /> },
  annoyed: { tint: "bg-ink text-white", icon: <ComplaintIcon size={22} lineWidth={2.3} /> },
  idea: { tint: "bg-amber text-ink", icon: <IdeaIcon size={22} lineWidth={2.3} /> },
  game: { tint: "bg-lapis text-white", icon: <GamesIcon size={22} lineWidth={2.3} /> },
  liked: { tint: "bg-magenta text-white", icon: <HeartIcon size={22} lineWidth={2.3} /> },
};

/** The round sticker of a type on the choices. */
export const TypeIcon = ({ type }: { type: FeedbackType }) => (
  <span className={`grid size-[42px] shrink-0 place-items-center rounded-full border-[3px] border-white shadow-[0_2px_3px_rgba(20,17,43,0.16)] ${looks[type].tint}`}>{looks[type].icon}</span>
);
