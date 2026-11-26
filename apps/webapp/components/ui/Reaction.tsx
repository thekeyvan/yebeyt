"use client";

import { animate, useAnimate } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { bigStyle, pieces, type ResultAction } from "../../lib/burst";
import { countUp, pop, popKeyframes, shake, turningOn, useVariant } from "../../lib/motion";
import { persianDigits } from "../../lib/persian";
import { BurstLayer, useFlight } from "./Burst";

type ReactionProps = {
  /** The reaction plays whenever this changes. */
  when?: unknown;
  /** Plays at once, when it first appears, too. */
  onAppear?: boolean;
  /** A pop, a pop with a wiggle, or the shake of a wrong answer. */
  effect: "pop" | "wiggle" | "shake";
  /** Ticks from a right answer, or the confetti of a won round; `big` throws them 74 out (a result: a finished game or the daily puzzle). */
  burst?: ResultAction;
  big?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * What a control does when something happens to it (`popWhen`, `shakeWhen` in Design/MotionEffects.swift): it pops, wiggles or shakes, and
 * a right answer or a won round throws its pieces. Under Reduce Motion a pop is a short scale, a shake does not move, and nothing flies.
 */
export function Reaction({ when, onAppear, effect, burst, big, className = "inline-block", children }: ReactionProps) {
  const v = useVariant();
  const [scope, animateScope] = useAnimate<HTMLSpanElement>();
  const [flight, fly] = useFlight();
  const last = useRef<{ value: unknown }>(undefined);

  useEffect(() => {
    const before = last.current;
    last.current = { value: when };
    if (before ? Object.is(before.value, when) : !onAppear) return;
    if (effect === "shake" || (effect === "wiggle" && v === "full")) {
      const { keyframes, transition } = popKeyframes(effect === "shake" ? shake(v) : turningOn("like", v));
      if (Object.keys(keyframes).length > 0) void animateScope(scope.current, keyframes, transition);
    } else {
      const { scale, times, duration } = pop(v);
      void animateScope(scope.current, { scale }, { times, duration });
    }
    if (burst && v === "full") fly(pieces(burst, Math.floor(Math.random() * 2 ** 32), big ? bigStyle : undefined));
    // What matters is that `when` changed.
  }, [when]);

  return (
    <span ref={scope} className={`relative ${className}`}>
      {children}
      {flight && <BurstLayer {...flight} />}
    </span>
  );
}

/** A number that counts up to its value (and again to a new one), in Persian digits: «+۷۱۰ امتیاز» is `prefix="+"` and `suffix=" امتیاز"`. */
export function CountUp({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const v = useVariant();
  const [shown, setShown] = useState(0);
  const now = useRef(0);
  useEffect(() => {
    const controls = animate(now.current, value, {
      ...countUp(v),
      onUpdate: (number) => {
        now.current = number;
        setShown(number);
      },
      onComplete: () => setShown(value),
    });
    return () => controls.stop();
    // `v` only picks how it counts.
  }, [value]);
  return <>{`${prefix}${persianDigits(Math.round(shown))}${suffix}`}</>;
}
