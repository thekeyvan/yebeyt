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

/** A list row that comes or goes (`Motion.row`: a couplet taken out of the divan or brought back): it scales from 0.9 and slides 12, and fades; under Reduce Motion it only fades. */
export const rowArrival = (v: Variant): { opacity: number; scale: number; y: number } => (v === "full" ? { opacity: 0, scale: 0.9, y: 12 } : { opacity: 0, scale: 1, y: 0 });

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

/** A cover (the reader) is as big as the screen, so it rises with a firm spring (it settles without going past the top; `bouncy` is for small things). */
export const coverRise = (v: Variant): Transition => (v === "full" ? spring(0.4, 0.9) : quick);

/** …and drops back quickly, with no overshoot (`Motion.drop`). */
export const coverDrop = (v: Variant): Transition => (v === "full" ? spring(0.25, 1) : quick);

/** Where a cover waits: a screen's height down; under Reduce Motion it stays in place and fades. */
export const coverAway = (v: Variant): { y: string; opacity: number } => (v === "full" ? { y: "100%", opacity: 1 } : { y: "0%", opacity: 0 });

/** One step of a pop: the value it goes to, and the seconds that takes. */
type Step = readonly [value: number, seconds: number];
type Property = "scale" | "rotate" | "x" | "y" | "opacity";
/** What an icon does when it is pressed on or off: the steps of each property it moves, which rest at 1 (scale and opacity) or 0. */
export type Pop = Partial<Record<Property, Step[]>>;

const rest: Record<Property, number> = { scale: 1, rotate: 0, x: 0, y: 0, opacity: 1 };

const reducedPop: Pop = { scale: [[1.05, 0.1], [1, 0.1]] };

/** Taking a mark off: smaller and shorter than turning it on, and still. */
export const turningOff = (v: Variant): Pop => (v === "full" ? { scale: [[1.15, 0.12], [0.95, 0.1], [1, 0.08]] } : reducedPop);

/**
 * What the icon of a like, a keep, a repost or a send does when it turns on (`Pop.turningOn(action, variant)`): a like pops with a
 * wiggle, a keep drops in from above with a bounce, a repost turns once around, a send flies off toward the corner and lands back.
 * Reduce Motion: a short scale for all. Points are pixels.
 */
export function turningOn(action: "like" | "keep" | "repost" | "send", v: Variant): Pop {
  if (v === "reduced") return reducedPop;
  switch (action) {
    case "like":
      return { scale: [[1.35, 0.12], [0.9, 0.12], [1.05, 0.11], [1, 0.1]], rotate: [[8, 0.11], [-8, 0.12], [4, 0.11], [0, 0.11]] };
    case "keep":
      return { scale: [[1.1, 0.15], [1, 0.25]], y: [[-18, 0.01], [5, 0.13], [-3, 0.1], [1.5, 0.09], [0, 0.09]] };
    case "repost":
      return { scale: [[1.2, 0.2], [1, 0.25]], rotate: [[360, 0.45]] };
    case "send":
      return { scale: [[0.9, 0.16], [0.9, 0.01], [1, 0.2]], x: [[26, 0.16], [-18, 0.01], [0, 0.2]], y: [[-26, 0.16], [18, 0.01], [0, 0.2]], opacity: [[0, 0.16], [0, 0.01], [1, 0.2]] };
  }
}

/** The keyframes and per-property timings that play a pop in Motion (`animate(element, keyframes, transition)`). */
export function popKeyframes(pop: Pop): { keyframes: Record<string, number[]>; transition: Record<string, Transition>; duration: number } {
  const keyframes: Record<string, number[]> = {};
  const transition: Record<string, Transition> = {};
  let duration = 0;
  for (const [property, steps] of Object.entries(pop) as [Property, Step[]][]) {
    const total = steps.reduce((sum, [, seconds]) => sum + seconds, 0);
    let elapsed = 0;
    keyframes[property] = [rest[property], ...steps.map(([value]) => value)];
    transition[property] = { duration: total, ease: "easeInOut", times: [0, ...steps.map(([, seconds]) => (elapsed += seconds) / total)] };
    duration = Math.max(duration, total);
  }
  return { keyframes, transition, duration };
}

/** Whether a press's particles fly: the action has some (a send has none) and Reduce Motion is off. */
export const bursts = (action: "like" | "keep" | "repost" | "send", v: Variant): boolean => v === "full" && action !== "send";

/** A wrong answer: side to side (pixels), stronger than the first shake, over 0.45 s; still under Reduce Motion (`Motion.shake`). */
export const shake = (v: Variant): Pop => (v === "full" ? { x: [[14, 0.05], [-14, 0.09], [10, 0.09], [-6, 0.09], [3, 0.08], [0, 0.05]] } : {});

/** A number counting up to its value: half a second, easing out; at once under Reduce Motion (`Motion.countUp`). */
export const countUp = (v: Variant): Transition => (v === "full" ? { duration: 0.5, ease: "easeOut" } : { duration: 0 });

/** A card thrown off the deck (`Motion.throwAway`). */
export const throwAway = spring(0.32, 0.72);

/** How a card on the deck sits: resting, or flung off to the side, tilted (`Motion.ThrowPose`); under Reduce Motion it stays and fades. */
export const restingPose = { rotate: 0, x: 0, y: 0, opacity: 1 };
export const thrownPose = (v: Variant): typeof restingPose => (v === "full" ? { rotate: -18, x: -480, y: -30, opacity: 1 } : { rotate: 0, x: 0, y: 0, opacity: 0 });

/** The next card of the deck springs in, a little smaller, and fades in (only the fade under Reduce Motion). */
export const dealArrival = (v: Variant): { scale: number; opacity: number } => ({ scale: v === "full" ? 0.8 : 1, opacity: 0 });
