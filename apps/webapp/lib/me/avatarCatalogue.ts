import { ACCESSORIES, BACKGROUNDS, EYES, HAIRS, MOUTHS, SKINS, STANDARD, type Accessory, type AvatarParts } from "@yebeyt/avatar";
import { persianDigits } from "../persian";

// The parts of a face and what the editor offers (Me/Avatar/AvatarParts.swift). The ids and colours are the shared package's (`@yebeyt/avatar`, which a test holds to the
// Swift); the names, the unlock rules and the cards are the editor's.

export type AvatarPart = "face" | "eyes" | "hair" | "mouth" | "accessory" | "background";

/** The chips of the editor, in board order (the first sits at the right). */
export const partChips: readonly { part: AvatarPart; title: string }[] = [
  { part: "face", title: "صورت" },
  { part: "eyes", title: "چشم" },
  { part: "hair", title: "مو" },
  { part: "mouth", title: "دهن" },
  { part: "accessory", title: "کلاه و همراه" },
  { part: "background", title: "زمینه" },
];

export type AvatarOption = { id: string; title: string };

export const standardParts: AvatarParts = STANDARD;

const skinTitles: Record<keyof typeof SKINS, string> = { peach: "هلویی", sand: "شنی", tan: "برنزه", brown: "قهوه‌ای", ivory: "عاجی" };
const hairTitles: Record<keyof typeof HAIRS, string> = { dark: "قهوه‌ای تیره", black: "مشکی", amber: "زرد", fire: "نارنجی", magenta: "صورتی", lapis: "لاجوردی" };
const backgroundTitles: Record<keyof typeof BACKGROUNDS, string> = { sun: "آفتابی", sky: "آسمانی", mint: "نعنایی", rose: "گلی", paper: "کاغذی", lapis: "لاجوردی" };
const eyeTitles: Record<(typeof EYES)[number], string> = { round: "گرد", happy: "خندان", wink: "چشمک" };
const mouthTitles: Record<(typeof MOUTHS)[number], string> = { smile: "لبخند", grin: "خنده", calm: "آروم" };

/** What the player has done that opens the locked accessories. */
export type AvatarProgress = { bookWins: number; bestStreak: number };

type Unlock = { kind: "bookWins" | "streak"; count: number } | { kind: "league" };

type AccessoryInfo = {
  id: Accessory;
  title: string;
  /** Undefined for an accessory that is open from the start. */
  unlock?: Unlock;
  /** The card under the grid: «نیِ مولانا · مثنوی» and a couplet of it. Nothing for «هیچی» and for the helmet, which stays locked. */
  card?: { source: string; couplet: string };
};

const info: Record<Accessory, Omit<AccessoryInfo, "id">> = {
  none: { title: "هیچی" },
  ney: { title: "نیِ مولانا", card: { source: "نیِ مولانا · مثنوی", couplet: "بشنو این نی چون شکایت می‌کند" } },
  rose: { title: "گل سرخِ حافظ", card: { source: "گل سرخِ حافظ · دیوان حافظ", couplet: "دلت به وصل گل ای بلبل صبا خوش باد" } },
  crown: { title: "تاجِ شاهنامه", unlock: { kind: "bookWins", count: 5 }, card: { source: "تاجِ شاهنامه · شاهنامه", couplet: "جهاندار هوشنگ با رای و داد" } },
  // Until leagues exist (W6) it stays locked.
  helmet: { title: "کلاه‌خودِ رستم", unlock: { kind: "league" } },
  candle: { title: "شمع و پروانه", unlock: { kind: "streak", count: 7 }, card: { source: "شمع و پروانه · دیوان عطار", couplet: "عشق جانان همچو شمعم از قدم تا سر بسوخت" } },
};

/** The board's six accessories, in order. */
export const accessories: readonly AccessoryInfo[] = ACCESSORIES.map((id) => ({ id, ...info[id] }));

const accessoryOf = (id: string): AccessoryInfo | undefined => accessories.find((item) => item.id === id);

export function isUnlocked(id: string, progress: AvatarProgress): boolean {
  const { unlock } = accessoryOf(id) ?? {};
  if (!unlock) return true;
  switch (unlock.kind) {
    case "bookWins":
      return progress.bookWins >= unlock.count;
    case "streak":
      return progress.bestStreak >= unlock.count;
    case "league":
      return false;
  }
}

/** The line under the name of a locked item, as on the board. */
export function accessoryUnlockText(id: string): string | undefined {
  const { unlock } = accessoryOf(id) ?? {};
  switch (unlock?.kind) {
    case "bookWins":
      return `${persianDigits(unlock.count)} برد توی «از کدوم کتاب؟»`;
    case "streak":
      return `${persianDigits(unlock.count)} روز پشت‌سرهم`;
    case "league":
      return "لیگ سخن‌دان";
    default:
      return undefined;
  }
}

/** The card under the grid for the chosen accessory. */
export const accessoryCard = (id: string): AccessoryInfo["card"] => accessoryOf(id)?.card;

const named = <T extends string>(titles: Record<T, string>): AvatarOption[] => (Object.keys(titles) as T[]).map((id) => ({ id, title: titles[id] }));

export function optionsFor(part: AvatarPart): AvatarOption[] {
  switch (part) {
    case "face":
      return named(skinTitles);
    case "eyes":
      return named(eyeTitles);
    case "hair":
      return named(hairTitles);
    case "mouth":
      return named(mouthTitles);
    case "accessory":
      return accessories.map(({ id, title }) => ({ id, title }));
    case "background":
      return named(backgroundTitles);
  }
}

/** Whether every part is an id of the catalogue (a saved or server face that isn't is replaced by the default). */
export const isValidParts = (parts: AvatarParts): boolean => partChips.every(({ part }) => optionsFor(part).some((option) => option.id === parts[part]));

/** The face with `option` chosen for `part`, when that is allowed: a locked accessory can't be chosen. */
export function choosing(option: string, part: AvatarPart, parts: AvatarParts, progress: AvatarProgress): AvatarParts | undefined {
  if (!optionsFor(part).some(({ id }) => id === option)) return undefined;
  if (part === "accessory" && !isUnlocked(option, progress)) return undefined;
  return { ...parts, [part]: option };
}

/** What a screen reader says for the face: «چهره‌ی تو، با نیِ مولانا». */
export function spokenFace(parts: AvatarParts): string {
  const item = accessoryOf(parts.accessory);
  return item && item.id !== "none" ? `چهره‌ی تو، با ${item.title}` : "چهره‌ی تو";
}
