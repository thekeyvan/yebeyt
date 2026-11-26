import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import type { Couplet } from "../../lib/poetry/models";
import { spacingFactor, type TextSettings } from "../../lib/reader/settings";
import { fontClass } from "./theme";

/** The style of a hemistich line the way the boards draw it: `size` is the board's font size and `factor` its line height as a multiple of it. */
export const lineStyle = (size: number, factor: number): CSSProperties => ({ fontSize: size, lineHeight: factor });

type Props = {
  couplet: Couplet;
  settings: Pick<TextSettings, "font" | "bold" | "layout" | "spacing">;
  size: number;
  factor?: number;
} & Omit<HTMLAttributes<HTMLDivElement>, "children">;

/** One couplet's two hemistichs, staggered (the first at the start, the second at the end) or centred (Reader/CoupletText.swift). */
export function CoupletText({ couplet, settings, size, factor = spacingFactor(settings.spacing), className, ...rest }: Props) {
  const staggered = settings.layout === "staggered";
  const align = (end: boolean) => (staggered ? (end ? "text-end" : "text-start") : "text-center");
  return (
    <div
      role="group"
      aria-label={couplet.m2 ? `${couplet.m1}، ${couplet.m2}` : couplet.m1}
      className={cn(fontClass(settings), className)}
      style={lineStyle(size, factor)}
      {...rest}
    >
      <div aria-hidden className={align(false)}>
        {couplet.m1}
      </div>
      {couplet.m2 && (
        <div aria-hidden className={align(true)}>
          {couplet.m2}
        </div>
      )}
    </div>
  );
}
