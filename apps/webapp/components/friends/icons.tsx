import { IconBox } from "../ui/IconBox";

/** A head and shoulders with a plus: «درخواست‌های دوستی» (the requests row of the inbox, Messages/InboxScreen.swift). */
export const AddPersonIcon = ({ size = 22 }: { size?: number }) => (
  <IconBox size={size} lineWidth={2.2}>
    <path d="M4 19.5c0-3.3 2.4-5.5 5.5-5.5s5.5 2.2 5.5 5.5M9.5 4.5a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8M19 7.5v5M16.5 10h5" />
  </IconBox>
);

/** The arrow of the green band on the league: «این ۵ نفر می‌رن لیگ بالاتر». */
export const UpArrowIcon = ({ size = 12 }: { size?: number }) => (
  <IconBox size={size} lineWidth={2.8}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </IconBox>
);
