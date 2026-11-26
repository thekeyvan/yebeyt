/** The username rules, mirroring the server (`apps/server/src/usernames.ts`) so the screen can answer while typing; the server stays the judge, and knows which names are taken (Account/UsernameRules.swift). */
export type UsernameProblem = "too_short" | "too_long" | "bad_chars" | "reserved" | "taken";

/** The line under the field. */
export const problemMessage: Record<UsernameProblem, string> = {
  taken: "قبلاً گرفته شده",
  too_short: "حداقل ۳ حرف",
  too_long: "حداکثر ۲۰ حرف",
  bad_chars: "فقط حروف انگلیسی، عدد، «_» و «.»",
  reserved: "این اسم رزرو شده",
};

const reserved = new Set([
  "yebeyt", "admin", "administrator", "support", "hello", "help", "api", "www", "root", "system",
  "moderator", "staff", "team", "official", "contact", "info", "security", "privacy", "terms",
  "null", "undefined", "me", "app", "ios", "android",
]);

/** The stored form: trimmed and lower-case. */
export const normalizeUsername = (text: string): string => text.trim().toLowerCase();

const isLetter = (char: string): boolean => char >= "a" && char <= "z";
const isAllowed = (char: string): boolean => isLetter(char) || (char >= "0" && char <= "9") || char === "_" || char === ".";

/** Checks the rules (not availability) of a normalized name. */
export function problem(name: string): Exclude<UsernameProblem, "taken"> | undefined {
  const chars = [...name];
  if (!chars.every(isAllowed)) return "bad_chars";
  if (chars.length < 3) return "too_short";
  if (chars.length > 20) return "too_long";
  if (!isLetter(chars[0]!) || name.includes("..") || name.endsWith(".")) return "bad_chars";
  return reserved.has(name) ? "reserved" : undefined;
}

/** A Latin base for the server's suggestions: the letters and digits of a name written in Latin letters, or «beyt» for a name that has none (Persian names). */
export function suggestionBase(displayName: string): string {
  const kept = displayName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/^[0-9]+/, "");
  const base = kept.slice(0, 16);
  return base.length >= 2 ? base : "beyt";
}

/** The hint under the field (onboarding and settings): the rules, and that saving a username holds it for 30 days. */
export const usernameHint = "حروف انگلیسی، عدد، «_» و «.» · ۳ تا ۲۰ حرف · تا ۳۰ روز نمی‌شه عوضش کرد.";

/** The personal invite link (https://yebeyt.com/i/<username>). */
export const inviteDisplay = (username: string): string => `yebeyt.com/i/${username}`;
export const inviteURL = (username: string): string => `https://${inviteDisplay(username)}`;

/** The display name rules, mirroring the server (`apps/server/src/profile.ts`): at most 30 characters, no control characters. An empty name is fine: it is just not saved. */
export type NameProblem = "too_long" | "control_chars";

export const nameProblemMessage: Record<NameProblem, string> = { too_long: "حداکثر ۳۰ حرف", control_chars: "این حرف توی اسم نمی‌شه" };

/** Checks a trimmed name. A ZWNJ (a format character) is allowed. */
export function nameProblem(name: string): NameProblem | undefined {
  if ([...name].length > 30) return "too_long";
  return /[\p{Cc}\p{Zl}\p{Zp}]/u.test(name) ? "control_chars" : undefined;
}
