import type { PaletteColor } from "../../lib/library/models";
import { ribbonColor, tokenColor } from "./palette";

/** The page block's fine lines, every 3 units: each runs from the slanted top edge to the slanted bottom edge. */
const pageLines = [2, 5, 8, 11].map((x) => {
  const at = x + 0.5;
  return `M${at} ${12 - (7 * (at - 2)) / 12}V${141 + (6 * (at - 2)) / 12}`;
});

/**
 * A book cover, drawn as in the SVG of the Explore, Library and Book boards (112×158): pages at the edge, the cover with its spine shade and
 * highlight, the ornament, the ribbon and the shadow below (Design/BookCover.swift). Never mirrored: the spine stays at the right.
 */
export function BookCover({ color, className }: { color: PaletteColor; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 112 158" className={className} style={{ aspectRatio: "112 / 158" }}>
      <ellipse cx="58" cy="151" rx="50" ry="5" fill="var(--color-ink)" fillOpacity="0.16" />
      <path d="M2 12L14 5V147L2 141z" fill="#FBF8F1" />
      {pageLines.map((line) => (
        <path key={line} d={line} stroke="#E2DCCF" strokeWidth="1" />
      ))}
      <rect x="12" y="3" width="98" height="146" rx="4" fill={tokenColor[color]} />
      <rect x="94" y="3" width="16" height="146" rx="4" fill="#000" fillOpacity="0.2" />
      <rect x="91" y="3" width="1.6" height="146" fill="#fff" fillOpacity="0.35" />
      <path d="M52 56C64 66 64 86 52 96C40 86 40 66 52 56z" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.4" />
      <path d="M30 140V156L35 152L40 156V140z" fill={tokenColor[ribbonColor[color]]} />
    </svg>
  );
}
