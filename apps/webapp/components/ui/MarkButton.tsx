"use client";

import { motion, useAnimate } from "motion/react";
import type { ReactNode } from "react";
import { pieces as makePieces, type BurstAction } from "../../lib/burst";
import { bursts, popKeyframes, turningOff, turningOn, usePress, useVariant } from "../../lib/motion";
import { BurstLayer, useFlight } from "./Burst";

type MarkButtonProps = {
  action: BurstAction;
  label: string;
  /** Whether the mark is on (a like, a repost, a keep); leave out for a send, which is never on. */
  selected?: boolean;
  /** What the press did: true when the mark turned on (or a send went), false when it turned off, nothing when it did not change (the gate opened instead). */
  onPress: () => boolean | void;
  className?: string;
  /** What is beside the icon and does not pop with it («نگه دار» next to its bookmark). */
  caption?: ReactNode;
  children: ReactNode;
};

/**
 * A like, repost, send or keep (`MarkButton` and `markMotion` in Design/MotionEffects.swift): it squishes while pressed, and when the
 * mark changes its icon does what the action does: hearts rise from a like, a bookmark drops in with ribbons, arrows spin and circle
 * out of a repost, a send flies off and lands back; turning off only pops a little. Under Reduce Motion: a short pop, no particles.
 */
export function MarkButton({ action, label, selected, onPress, className, caption, children }: MarkButtonProps) {
  const press = usePress();
  const v = useVariant();
  const [icon, animateIcon] = useAnimate<HTMLSpanElement>();
  const [flight, fly] = useFlight();

  function pressed() {
    const result = onPress();
    if (result === undefined) return;
    const on = action === "send" || result;
    const { keyframes, transition } = popKeyframes(on ? turningOn(action, v) : turningOff(v));
    void animateIcon(icon.current, keyframes, transition);
    if (!on || !bursts(action, v)) return;
    fly(makePieces(action, Math.floor(Math.random() * 2 ** 32)));
  }

  return (
    <motion.button type="button" {...press} aria-label={label} aria-pressed={selected} onClick={pressed} className={`relative ${className ?? ""}`}>
      <span ref={icon} className="grid place-items-center">
        {children}
      </span>
      {caption}
      {flight && <BurstLayer {...flight} />}
    </motion.button>
  );
}
