import type { ReaderTheme, TextSettings } from "../../lib/reader/settings";

/** The three reader themes as classes (Reader/TextSettings.swift `ReaderTheme`): the page, the text, quieter text, the unread part of the progress rail, and the faint neighbouring lines. */
export const themeClasses: Record<ReaderTheme, { page: string; text: string; secondary: string; track: string; faint: string }> = {
  light: { page: "bg-white", text: "text-ink", secondary: "text-muted", track: "bg-ring", faint: "text-ink/25" },
  paper: { page: "bg-board-paper", text: "text-ink", secondary: "text-muted", track: "bg-ring", faint: "text-ink/25" },
  dark: { page: "bg-ink", text: "text-board-paper", secondary: "text-board-paper/65", track: "bg-board-paper/20", faint: "text-board-paper/25" },
};

/** The font of the poem. Only Parastoo has a bold file (and a regular one); it is drawn at 84% by its font-face, so sizes here are the boards'. */
export function fontClass({ font, bold }: Pick<TextSettings, "font" | "bold">): string {
  switch (font) {
    case "parastoo":
      return bold ? "font-poem" : "font-poem-regular";
    case "naskh":
      return "font-naskh";
    case "nastaliq":
      return "font-nastaliq";
    case "gandom":
      return "font-gandom";
    case "markazi":
      return "font-markazi";
    case "shabnam":
      return "font-shabnam";
    case "sahel":
      return "font-sahel";
    case "vazir":
      return "font-vazir";
  }
}
