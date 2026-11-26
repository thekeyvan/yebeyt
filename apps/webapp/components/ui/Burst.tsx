"use client";

import { animate } from "motion/react";
import { useState } from "react";
import { frame, type Piece, type Tint } from "../../lib/burst";

const tints: Record<Tint, string> = { magenta: "text-magenta", lapis: "text-lapis", fire: "text-fire", amber: "text-amber", green: "text-green" };

/** How long the pieces fly (`Motion.burstDuration`). */
const burstSeconds = 0.6;

const stroked = new Set(["arrow", "tick"]);

function Shape({ piece }: { piece: Piece }) {
  const { kind, size } = piece;
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill={stroked.has(kind) ? "none" : "currentColor"} stroke={stroked.has(kind) ? "currentColor" : "none"} strokeWidth={5.3} strokeLinecap="round" strokeLinejoin="round">
      {kind === "heart" && <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z" />}
      {kind === "ribbon" && <path d="M6 3.5h12v17l-6-4-6 4z" />}
      {kind === "arrow" && <path d="M4 12h16M14 6l6 6-6 6" />}
      {kind === "tick" && <path d="M4 12.5l5.5 5.5L20 6.5" />}
      {kind === "dot" && <circle cx="12" cy="12" r="10" />}
      {kind === "dash" && <rect x="1" y="8.5" width="22" height="7" rx="3.5" />}
      {kind === "square" && <rect x="3" y="3" width="18" height="18" rx="3" />}
    </svg>
  );
}

/** How a piece is turned: a ribbon points up from its heading, a dash and an arrow along it, a square by its own spin. */
function turnOf(piece: Piece, heading: number, rotation: number): number {
  if (piece.kind === "ribbon") return heading - 90;
  if (piece.kind === "arrow" || piece.kind === "dash") return heading;
  return piece.kind === "square" ? rotation : 0;
}

export type BurstInFlight = { pieces: Piece[]; progress: number };

/** The pieces of one burst at `progress` (0…1), out from the middle of the control they are put in. */
export function BurstLayer({ pieces, progress }: BurstInFlight) {
  return (
    <span aria-hidden data-testid="burst" className="pointer-events-none absolute inset-0 grid place-items-center">
      {pieces.map((piece) => {
        const { dx, dy, scale, opacity, heading, rotation } = frame(piece, progress);
        return (
          <span key={piece.id} className={`absolute ${tints[piece.tint]}`} style={{ opacity, transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${turnOf(piece, heading, rotation)}deg)` }}>
            <Shape piece={piece} />
          </span>
        );
      })}
    </span>
  );
}

/** The burst in flight, and the way to start one: it flies for 0.6 s and is gone. */
export function useFlight(): [BurstInFlight | undefined, (pieces: Piece[]) => void] {
  const [flight, setFlight] = useState<BurstInFlight>();
  const start = (pieces: Piece[]) => {
    setFlight({ pieces, progress: 0 });
    animate(0, 1, {
      duration: burstSeconds,
      ease: "linear",
      onUpdate: (progress) => setFlight({ pieces, progress }),
      onComplete: () => setFlight(undefined),
    });
  };
  return [flight, start];
}
