import { readJSON, Store, writeJSON, type KeyValueStorage } from "./store";

/** The fonts of the «آ» sheet, in the board's order (Reader/TextSettings.swift). Only Parastoo has a bold file. */
export const readerFonts = [
  { id: "parastoo", title: "پرستو" },
  { id: "naskh", title: "نسخ" },
  { id: "nastaliq", title: "نستعلیق" },
  { id: "gandom", title: "گندم" },
  { id: "markazi", title: "مرکزی" },
  { id: "shabnam", title: "شبنم" },
  { id: "sahel", title: "ساحل" },
  { id: "vazir", title: "وزیر" },
] as const;

export type ReaderFont = (typeof readerFonts)[number]["id"];
export const hemistichLayouts = [
  { id: "staggered", title: "پلکانی" },
  { id: "centered", title: "وسط‌چین" },
] as const;
export type HemistichLayout = (typeof hemistichLayouts)[number]["id"];

/** The line height as a multiple of the font size (the board's `line-height`). */
export const spacings = [
  { id: "tight", title: "کم", factor: 1.5 },
  { id: "normal", title: "معمولی", factor: 1.8 },
  { id: "loose", title: "زیاد", factor: 2.1 },
] as const;
export type TextSpacing = (typeof spacings)[number]["id"];

export const themes = [
  { id: "light", title: "روشن" },
  { id: "paper", title: "کاغذی" },
  { id: "dark", title: "تیره" },
] as const;
export type ReaderTheme = (typeof themes)[number]["id"];

/** The slider's range, in the board's font sizes for the couplet page. */
export const sizeRange = { min: 15, max: 25 } as const;

export type TextSettings = {
  size: number;
  font: ReaderFont;
  bold: boolean;
  layout: HemistichLayout;
  spacing: TextSpacing;
  theme: ReaderTheme;
};

export const defaultSettings: TextSettings = { size: 21, font: "parastoo", bold: true, layout: "staggered", spacing: "loose", theme: "paper" };

export const clampSize = (size: number): number => Math.min(Math.max(Math.round(size), sizeRange.min), sizeRange.max);

export const spacingFactor = (spacing: TextSpacing): number => spacings.find(({ id }) => id === spacing)!.factor;

/** Only Parastoo has a bold weight. */
export const canChooseWeight = ({ font }: TextSettings): boolean => font === "parastoo";

/** The whole-poem list is a little smaller and tighter than the couplet page (20 / 1.9 against 21 / 2.1). */
export const listSize = ({ size }: TextSettings): number => size - 1;
export const listFactor = ({ spacing }: TextSettings): number => Math.round((spacingFactor(spacing) - 0.2) * 10) / 10;

const oneOf = <T extends string>(options: readonly { id: T }[], value: unknown, fallback: T): T => options.find(({ id }) => id === value)?.id ?? fallback;

/** Missing or unknown values fall back to the defaults, so older saved settings keep working. */
export function parseSettings(saved: unknown): TextSettings {
  const value = (typeof saved === "object" && saved !== null ? saved : {}) as Record<string, unknown>;
  return {
    size: typeof value.size === "number" && Number.isFinite(value.size) ? clampSize(value.size) : defaultSettings.size,
    font: oneOf(readerFonts, value.font, defaultSettings.font),
    bold: typeof value.bold === "boolean" ? value.bold : defaultSettings.bold,
    layout: oneOf(hemistichLayouts, value.layout, defaultSettings.layout),
    spacing: oneOf(spacings, value.spacing, defaultSettings.spacing),
    theme: oneOf(themes, value.theme, defaultSettings.theme),
  };
}

/** Where the settings are kept in localStorage: the name iOS uses in UserDefaults, and the same JSON. */
export const settingsKey = "reader.textSettings";

/** Holds the settings and keeps every change in the storage. They apply to both reading modes. */
export class TextSettingsStore extends Store<TextSettings> {
  constructor(private readonly storage: KeyValueStorage) {
    super(parseSettings(readJSON(storage, settingsKey)));
  }

  update(change: Partial<TextSettings>): void {
    const next = parseSettings({ ...this.snapshot(), ...change });
    writeJSON(this.storage, settingsKey, next);
    this.set(next);
  }
}
