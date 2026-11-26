"use client";

import { animate, motion, useAnimate } from "motion/react";
import { useState, type ReactNode } from "react";
import { frame, pieces as makePieces, type BurstAction, type Piece, type Tint } from "../../lib/burst";
import { bursts, popKeyframes, turningOff, turningOn, usePress, useVariant } from "../../lib/motion";

const tints: Record<Tint, string> = { magenta: "text-magenta", lapis: "text-lapis", fire: "text-fire" };

/** How long the pieces fly (`Motion.burstDuration`). */
const burstSeconds = 0.6;

function Shape({ piece }: { piece: Piece }) {
  const { kind, size } = piece;
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill={kind === "arrow" ? "none" : "currentColor"} stroke={kind === "arrow" ? "currentColor" : "none"} strokeWidth={5.3} strokeLinecap="round" strokeLinejoin="round">
      {kind === "heart" && <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z" />}
      {kind === "ribbon" && <path d="M6 3.5h12v17l-6-4-6 4z" />}
      {kind === "arrow" && <path d="M4 12h16M14 6l6 6-6 6" />}
    </svg>
  );
}

/** The pieces of one burst at `progress` (0…1): hearts, ribbons or arrows, out from the middle of the control. */
function Burst({ pieces, progress }: { pieces: Piece[]; progress: number }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      {pieces.map((piece) => {
        const { dx, dy, scale, opacity, heading } = frame(piece, progress);
        const turn = piece.kind === "ribbon" ? heading - 90 : piece.kind === "arrow" ? heading : 0;
        return (
          <span key={piece.id} className={`absolute ${tints[piece.tint]}`} style={{ opacity, transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${turn}deg)` }}>
            <Shape piece={piece} />
          </span>
        );
      })}
    </span>
  );
}

type MarkButtonProps = {
  action: BurstAction;
  label: string;
  /** Whether the mark is on (a like, a repost, a keep); leave out for a send, which is never on. */
  selected?: boolean;
  /** What the press did: true when the mark turned on (or a send went), false when it turned off, nothing when it did not change (the gate opened instead). */
  onPress: () => boolean | void;
  className?: string;
  children: ReactNode;
};

/**
 * A like, repost, send or keep (`MarkButton` and `markMotion` in Design/MotionEffects.swift): it squishes while pressed, and when the
 * mark changes its icon does what the action does: hearts rise from a like, a bookmark drops in with ribbons, arrows spin and circle
 * out of a repost, a send flies off and lands back; turning off only pops a little. Under Reduce Motion: a short pop, no particles.
 */
export function MarkButton({ action, label, selected, onPress, className, children }: MarkButtonProps) {
  const press = usePress();
  const v = useVariant();
  const [icon, animateIcon] = useAnimate<HTMLSpanElement>();
  const [flight, setFlight] = useState<{ pieces: Piece[]; progress: number }>();

  function pressed() {
    const result = onPress();
    if (result === undefined) return;
    const on = action === "send" || result;
    const { keyframes, transition } = popKeyframes(on ? turningOn(action, v) : turningOff(v));
    void animateIcon(icon.current, keyframes, transition);
    if (!on || !bursts(action, v)) return;
    const pieces = makePieces(action, Math.floor(Math.random() * 2 ** 32));
    setFlight({ pieces, progress: 0 });
    animate(0, 1, {
      duration: burstSeconds,
      ease: "linear",
      onUpdate: (progress) => setFlight({ pieces, progress }),
      onComplete: () => setFlight(undefined),
    });
  }

  return (
    <motion.button type="button" {...press} aria-label={label} aria-pressed={selected} onClick={pressed} className={`relative ${className ?? ""}`}>
      <span ref={icon} className="grid place-items-center">
        {children}
      </span>
      {flight && <Burst {...flight} />}
    </motion.button>
  );
}
