"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "../../lib/cn";
import { usePress } from "../../lib/motion";

export type ButtonVariant = "primary" | "fire" | "ghost";

const look: Record<ButtonVariant, string> = {
  primary: "border-button border-white bg-lapis px-[22px] pt-[9px] pb-[5px] text-white shadow-button",
  fire: "border-button border-white bg-fire px-[22px] pt-[9px] pb-[5px] text-white shadow-button",
  ghost: "bg-white px-[22px] pt-3 pb-2 text-ink shadow-secondary-button",
};

/**
 * «بزن بریم» (primary: lapis), the red one that does what can't be undone (fire) and «بعداً» (ghost: white): the sticker
 * buttons of Design/Sticker.swift. Every one squishes while it is pressed.
 */
export function Button({ variant = "primary", className, ...props }: HTMLMotionProps<"button"> & { variant?: ButtonVariant }) {
  const press = usePress();
  return (
    <motion.button
      type="button"
      {...press}
      className={cn(
        "inline-flex items-center justify-center rounded-button font-title text-[21px] leading-[1.5] active:opacity-85 disabled:opacity-50",
        look[variant],
        className,
      )}
      {...props}
    />
  );
}
