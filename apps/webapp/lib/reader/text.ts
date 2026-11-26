import { persianDigits } from "../persian";
import type { Couplet } from "../poetry/models";

// The words the reader writes around a couplet (Reader/ReaderText.swift).

/** «غزل شمارهٔ ۳» → «غزل ۳». */
export const shortTitle = (title: string): string => title.replaceAll("شمارهٔ ", "");

/** «حافظ · غزلیات»; just the poet while the book title is not known. */
export const subtitle = (poet: string, book?: string): string => (book ? `${poet} · ${book}` : poet);

/** «۲ از ۹» for the couplet at the 0-based `index`. Never «۲/۹»: it reorders in right-to-left text. */
export const progress = (index: number, count: number): string => `${persianDigits(index + 1)} از ${persianDigits(count)}`;

export const progressLabel = (index: number, count: number): string => `بیت ${progress(index, count)}`;

const lines = ({ m1, m2 }: Couplet): string => (m2 ? `${m1}\n${m2}` : m1);

/** The text of the share sheet. */
export const shareText = (couplet: Couplet, poet: string, title: string): string => `${lines(couplet)}\n— ${poet} · ${title}\nyebeyt.com`;

/** The text «کپی متن» puts on the clipboard. */
export const copyText = (couplet: Couplet, poet: string): string => `${lines(couplet)}\n— ${poet}`;

/** The caption under a lifted couplet: «حافظ · غزل ۳ · بیت ۲». */
export const caption = (poet: string, title: string, index: number): string => `${poet} · ${title} · بیت ${persianDigits(index + 1)}`;

/** «۰:۴۲» for 42 seconds, «۱:۲۸» for 88: the time on the seek bar, minutes and seconds. */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${persianDigits(Math.floor(whole / 60))}:${persianDigits(whole % 60).padStart(2, "۰")}`;
}
