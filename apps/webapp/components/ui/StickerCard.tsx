import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

/**
 * A white card: straight, white border, soft shadow, no outline (Design/Sticker.swift `stickerCard`). The border sits
 * inside the outer edge and the content's own padding goes inside the border, so give the padding in `className`.
 * `fill` is a background class for a card that is not white.
 */
export function StickerCard({ fill = "bg-white", className, ...props }: ComponentProps<"div"> & { fill?: string }) {
  return <div className={cn("rounded-card border-card border-white shadow-card", fill, className)} {...props} />;
}
