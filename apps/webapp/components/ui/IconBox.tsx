import type { ReactNode } from "react";

type IconBoxProps = {
  size?: number;
  /** The stroke width in box units (as in the SVG); none draws a filled glyph. */
  lineWidth?: number;
  /** What the shapes are filled with; none by default. */
  fill?: string;
  children: ReactNode;
};

/**
 * The 24×24 box our icons are drawn in (Design/IconBox.swift): it scales the box to `size`, strokes with the text colour
 * and is never mirrored in right-to-left, so the paper plane, the magnifier and the flame keep their direction.
 * The label belongs to the control around the icon.
 */
export function IconBox({ size = 24, lineWidth, fill = "none", children }: IconBoxProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={lineWidth ? "currentColor" : "none"}
      strokeWidth={lineWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}
