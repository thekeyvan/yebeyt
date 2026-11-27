import { hemistichLayouts, readerFonts, spacings, themes, type TextSettings } from "../reader/settings";
import type { SettingValue } from "./technical";

const titleIn = <T extends { id: string; title: string }>(list: readonly T[], id: string): string => list.find((item) => item.id === id)?.title ?? id;

/** The «آ» sheet's choices as `technical.textSettings`: the size, the switch and the titles of the choices (never anything typed). */
export function textSettingValues(settings: TextSettings): Record<string, SettingValue> {
  return {
    size: settings.size,
    font: titleIn(readerFonts, settings.font),
    bold: settings.bold,
    layout: titleIn(hemistichLayouts, settings.layout),
    spacing: titleIn(spacings, settings.spacing),
    theme: titleIn(themes, settings.theme),
  };
}
