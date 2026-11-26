import { IconBox } from "../ui/IconBox";

// The icons of the Me screens, from the inline SVG paths of the boards Profile, Divan, Privacy, Avatar and InviteFriends (Me/MeIcons.swift): a 24×24 box, never mirrored.

type LineIconProps = { size?: number; lineWidth?: number; fill?: string };

/** تنظیمات */
export const GearIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </IconBox>
);

/** ویرایش چهره (the pencil on the face) */
export const PencilIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </IconBox>
);

/** خودم بنویسم */
export const WriteIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <path d="M4 20l4-1 11-11-3-3L5 16z" />
  </IconBox>
);

/** A closed padlock: «فقط من», the lock badge of a locked item, the privacy note. */
export const LockIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </IconBox>
);

/** The badge star (filled when earned, an outline when locked). */
export const BadgeStarIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />
  </IconBox>
);

/** پیامک */
export const SmsIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
  </IconBox>
);

/** واتس‌اپ */
export const WhatsAppIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3zM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .9a5 5 0 0 1-2.8-2.8l.9-1-1-2z" />
  </IconBox>
);

/** کپی لینک */
export const LinkIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </IconBox>
);

/** بیشتر (three dots) */
export const MoreIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    {[6, 12, 18].map((x) => (
      <circle key={x} cx={x} cy="12" r="1.4" fill="currentColor" stroke="none" />
    ))}
  </IconBox>
);

/** استوری: a dashed circle with a plus */
export const StoryIcon = ({ size = 24, lineWidth = 2.2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <circle cx="12" cy="12" r="8.5" strokeDasharray="3 2.2" />
    <path d="M12 8.5v7M8.5 12h7" />
  </IconBox>
);
