import type { PaletteColor } from "../../lib/library/models";

// The six colours of curation.json (Library/PaletteColor.swift).

/** A book cover's colour, and a poet's card: the token itself. */
export const tokenColor: Record<PaletteColor, string> = {
  lapis: "var(--color-lapis)",
  fire: "var(--color-fire)",
  amber: "var(--color-amber)",
  green: "var(--color-green)",
  magenta: "var(--color-magenta)",
  ink: "var(--color-ink)",
};

/** The ribbon on a cover, as in the Library board. */
export const ribbonColor: Record<PaletteColor, PaletteColor> = { lapis: "magenta", fire: "amber", magenta: "amber", green: "lapis", amber: "lapis", ink: "fire" };

/** A poet's circle: the deeper shades of the Explore board (the amber is ours: the board has no amber poet). */
export const poetCircleColor: Record<PaletteColor, string> = {
  lapis: "var(--color-lapis)",
  fire: "#E8431C",
  amber: "#E09A00",
  green: "#3E9A1E",
  magenta: "#E0307A",
  ink: "var(--color-ink)",
};

/** The circle on the poet's own card, a shade darker than the card (the Poet board: #1C20B8 on lapis): the circle's colour at 75%. */
export const poetCardCircleColor: Record<PaletteColor, string> = {
  lapis: "#2328B8",
  fire: "#AE3215",
  amber: "#A87400",
  green: "#2F7417",
  magenta: "#A8245C",
  ink: "#0F0D20",
};

/** Text on a card of this colour: white, but ink on amber (as on the games cards). */
export const onColor = (color: PaletteColor): string => (color === "amber" ? "text-ink" : "text-white");
