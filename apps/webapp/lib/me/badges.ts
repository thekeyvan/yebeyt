/** The «سطح» card: the level from the total points (Me/Profile/Achievements.swift `Level`). */
const levels = [
  { name: "نوآموز", from: 0 },
  { name: "بیت‌خوان", from: 500 },
  { name: "غزل‌باز", from: 2000 },
  { name: "سخن‌دان", from: 5000 },
  { name: "استاد سخن", from: 12_000 },
] as const;

/** The name of a league's tier, which are the levels' names; a tier out of range is the nearest one. */
export const tierName = (tier: number): string => levels[Math.min(Math.max(tier, 0), levels.length - 1)]!.name;

export const levelName = (points: number): string => levels.findLast((level) => points >= level.from)?.name ?? levels[0].name;

/** What the badges are measured on. */
export type BadgeProgress = { bestStreak: number; hafezRight: number; coupletsRead: number };

export type BadgeColor = "fire" | "amber" | "lapis" | "green";

/** A badge: its name, the rule that earns it, and how it looks. Locked badges are drawn grey. */
export type Badge = {
  id: string;
  title: string;
  rule: string;
  color: BadgeColor;
  /** The tilt of the sticker, in degrees (the board's). */
  tilt: number;
  earned: boolean;
};

export function allBadges(progress: BadgeProgress): Badge[] {
  return [
    { id: "streak7", title: "۷ روز", rule: "۷ روز پشت‌سرهم معمای روز رو حل کن", color: "fire", tilt: -8, earned: progress.bestStreak >= 7 },
    // The first مشاعره needs friends (W8): locked until then.
    { id: "firstMosh", title: "اولین مشاعره", rule: "اولین مشاعره‌ت رو بازی کن", color: "amber", tilt: 6, earned: false },
    { id: "hafez", title: "حافظ‌شناس", rule: "به ۵۰ بیت حافظ درست جواب بده", color: "lapis", tilt: -4, earned: progress.hafezRight >= 50 },
    { id: "read100", title: "۱۰۰ بیت", rule: "۱۰۰ بیت بخون", color: "green", tilt: 0, earned: progress.coupletsRead >= 100 },
  ];
}
