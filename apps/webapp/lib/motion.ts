// The motion vocabulary of the iOS app (apps/ios/Yebeyt/Design/Motion.swift), in one place. Reduce Motion picks the
// `reduced` variant: nothing slides, scales or springs far (the press squish shrinks to 0.97 and does not bounce).
import { useReducedMotion, type Transition } from "motion/react";

export type Variant = "full" | "reduced";

export const variant = (reduceMotion: boolean | null): Variant => (reduceMotion ? "reduced" : "full");

export const useVariant = (): Variant => variant(useReducedMotion());

/** SwiftUI's `.spring(response:dampingFraction:)` as Motion's spring (a mass of 1, like SwiftUI). */
export function spring(response: number, dampingFraction: number): { type: "spring"; stiffness: number; damping: number; mass: 1 } {
  const omega = (2 * Math.PI) / response;
  return { type: "spring", stiffness: omega ** 2, damping: 2 * dampingFraction * omega, mass: 1 };
}

/** Things that appear or move: a visible overshoot. */
export const bouncy = spring(0.35, 0.55);
/** A pressed button letting go: springs back past 1. */
export const press = spring(0.3, 0.5);

/** How far a page slides in: from the side of its tab (or segment). */
export const tabSlide = 40;

export const pressedScale = (v: Variant): number => (v === "full" ? 0.92 : 0.97);

/** A plain quick move, for Reduce Motion. */
const quick: Transition = { duration: 0.1, ease: "easeOut" };

export const pressTransition = (v: Variant): Transition => (v === "full" ? press : quick);

/** Things that move to their place (a tab's underline): `bouncy`, or a quick plain move under Reduce Motion. */
export const settle = (v: Variant): Transition => (v === "full" ? bouncy : quick);

/** The props that make a Motion element squish while it is pressed (`PressStyle`). */
export function usePress(): { whileTap: { scale: number }; transition: Transition } {
  const v = useVariant();
  return { whileTap: { scale: pressedScale(v) }, transition: pressTransition(v) };
}

/** A toast drops in from above, a little smaller (only fades under Reduce Motion). */
export const toastArrival = (v: Variant): { y: number; scale: number } => (v === "full" ? { y: -28, scale: 0.9 } : { y: 0, scale: 1 });

/** A menu, a dialog or a card that appears: a little smaller. */
export const menuArrival = (v: Variant): { scale: number } => ({ scale: v === "full" ? 0.9 : 1 });

/**
 * A pop (Motion.Pop.turningOn): the scale goes 1 → 1.35 → 0.9 → 1.05 → 1 over 0.45 s. Reduce Motion makes it a short scale to
 * 1.05 and back (iOS takes 0.2 s; here under 0.15, so nothing that moves lasts longer).
 */
export const pop = (v: Variant): { scale: number[]; times: number[]; duration: number } =>
  v === "full"
    ? { scale: [1, 1.35, 0.9, 1.05, 1], times: [0, 0.12 / 0.45, 0.24 / 0.45, 0.35 / 0.45, 1], duration: 0.45 }
    : { scale: [1, 1.05, 1], times: [0, 0.5, 1], duration: 0.14 };

/** The page is right-to-left (false while rendering on the server, where there is no page to ask). */
export const isRightToLeft = (): boolean => typeof document !== "undefined" && document.documentElement.dir === "rtl";

/**
 * Where a page comes from, in pixels to the right of its resting place (`x`): the side its tab is on. In right-to-left
 * the first tab is at the right, so a tab after the open one is at the left. `null` when there is no earlier page.
 */
export function slideFrom(from: number | null, to: number, rightToLeft: boolean, v: Variant): number {
  if (v === "reduced" || from === null || from === to) return 0;
  const toTheRight = to > from !== rightToLeft;
  return toTheRight ? tabSlide : -tabSlide;
}
