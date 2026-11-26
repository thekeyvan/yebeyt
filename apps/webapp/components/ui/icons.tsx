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
