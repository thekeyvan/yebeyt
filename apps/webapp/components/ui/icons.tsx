import { IconBox } from "./IconBox";

/** The icons of the tab bar and the badges: the SVG paths of design/canvas/gen_explore.py, as on iOS (Design/Icons.swift). */
type LineIconProps = { size?: number; lineWidth?: number; fill?: string };

/** خونه */
export const HomeIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <path d="M4 11l8-7 8 7v8.5a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19.5z" />
  </IconBox>
);

/** کاوش */
export const ExploreIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </IconBox>
);

/** بازی: a game controller; its two buttons are tiny circles that the stroke turns into dots. */
export const GamesIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <rect x="2.5" y="7" width="19" height="11" rx="5" />
    <path d="M7.5 10.5v4M5.5 12.5h4" />
    <circle cx="15.5" cy="11.5" r="0.7" fill="currentColor" />
    <circle cx="17.5" cy="13.5" r="0.7" fill="currentColor" />
  </IconBox>
);

/** پیام‌ها */
export const MessagesIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" />
  </IconBox>
);

/** من: a head and shoulders, until people have their own faces (slice W5). */
export const MeIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <circle cx="12" cy="9" r="3.5" />
    <path d="M5 20c1-3.6 3.8-5.5 7-5.5s6 1.9 7 5.5" />
  </IconBox>
);

/** The streak flame (filled). */
export const FlameIcon = ({ size = 14 }: { size?: number }) => (
  <IconBox size={size} fill="currentColor">
    <path d="M12 22c-4.4 0-7.5-3-7.5-7.1 0-3.7 2.8-5.8 4.1-9.1 1.7 1.5 2.4 3.2 2.4 5 1.5-.9 2.6-2.6 2.8-5 2.8 2.2 5.7 5.4 5.7 9.1 0 4.1-3.1 7.1-7.5 7.1z" />
  </IconBox>
);

/** The points star (filled). */
export const StarIcon = ({ size = 14 }: { size?: number }) => (
  <IconBox size={size} fill="currentColor">
    <path d="M12 2.5l2.9 6.1 6.7.8-5 4.6 1.3 6.6L12 17.4l-5.9 3.2 1.3-6.6-5-4.6 6.7-.8z" />
  </IconBox>
);

// The reader's icons: the SVG paths of the boards Poem, PoemMeaning, PoemScroll and PoemScrollHold (Design/ReaderIcons.swift).
// The paper plane (بفرست) is `MessagesIcon`.

/** The round close button's chevron. */
export const ChevronDownIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <path d="M6 9l6 6 6-6" />
  </IconBox>
);

/** The × of the meaning card. */
export const CloseIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <path d="M6 6l12 12M18 6L6 18" />
  </IconBox>
);

/** پسند */
export const HeartIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z" />
  </IconBox>
);

/** بازنشر */
export const RepostIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <path d="M17 3l3 3-3 3M4 12V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 12v3a3 3 0 0 1-3 3H4" />
  </IconBox>
);

/** نگه دار */
export const BookmarkIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <path d="M6 3.5h12v17l-6-4-6 4z" />
  </IconBox>
);

/** معنی این بیت (an open book) */
export const BookIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
  </IconBox>
);

/** بیت به بیت، از همین بیت (corner brackets round two lines) */
export const CoupletFocusIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 10.5h8M9.5 13.5h5" />
  </IconBox>
);

/** کپی متن */
export const CopyIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <rect x="8" y="8" width="12" height="12" rx="2.5" />
    <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
  </IconBox>
);

/** به دیوان مشترک (two books) */
export const SharedDivanIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <path d="M4 8.5A2 2 0 0 1 6 6.5H13A2 2 0 0 1 15 8.5V18.5A2 2 0 0 1 13 20.5H6A2 2 0 0 1 4 18.5ZM7.5 6.5V20.5M9 6.5V6A2 2 0 0 1 11 4H18A2 2 0 0 1 20 6V16A2 2 0 0 1 18 18H15" />
  </IconBox>
);

/** The recitation's play triangle (filled). */
export const PlayIcon = ({ size = 14 }: { size?: number }) => (
  <IconBox size={size} fill="currentColor">
    <path d="M7 4v16l13-8z" />
  </IconBox>
);

/** The voice chip's microphone («صدای دیگه»). */
export const VoiceIcon = ({ size = 24, lineWidth = 2, fill }: LineIconProps) => (
  <IconBox size={size} lineWidth={lineWidth} fill={fill}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </IconBox>
);

/** The mark of a meaning an AI wrote: a big four-point star and a small one (Design/AISparkle.swift). */
export const SparkleIcon = ({ size = 16 }: { size?: number }) => (
  <IconBox size={size} lineWidth={1.6} fill="currentColor">
    <path d="M10 3.5l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1-5.1-1.9 5.1-1.9zM18.5 14.5l.9 2.1 2.1 .9-2.1 .9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
  </IconBox>
);
