import type { ReactNode } from "react";
import type { GameKind } from "../../lib/games/kinds";

const white = "var(--color-white)";
const ink = "var(--color-ink)";
const lapis = "var(--color-lapis)";
const amber = "var(--color-amber)";
const green = "var(--color-green)";
const magenta = "var(--color-magenta)";

type Stroke = { color: string; width?: number; dash?: string };

/** A stroked path, round at the ends and corners, 2.1 wide unless asked for another. */
const Line = ({ d, color, width = 2.1 }: { d: string; color: string; width?: number }) => <path d={d} fill="none" stroke={color} strokeWidth={width} />;
const Box = ({ x, y, w, h, r, fill, stroke }: { x: number; y: number; w: number; h: number; r: number; fill?: string; stroke?: Stroke }) => (
  <rect x={x} y={y} width={w} height={h} rx={r} fill={fill ?? "none"} stroke={stroke?.color} strokeWidth={stroke?.width ?? 2.1} strokeDasharray={stroke?.dash} />
);

/** The nine glyphs, translated from `_glyph` in design/canvas/gameicons.py (Games/GameGlyphs.swift), drawn in a 24×24 box. `edge` is the sticker's own colour, used where a glyph cuts into itself. */
function parts(kind: GameKind, edge: string): ReactNode {
  switch (kind) {
    case "daily":
      return (
        <>
          <Box x={4} y={5.5} w={16} h={14.5} r={3} stroke={{ color: white }} />
          <Line d="M8.5 3.5v4M15.5 3.5v4" color={white} />
          <Box x={7} y={11.2} w={4.4} h={5.6} r={1.2} fill={amber} />
          <Box x={12.6} y={11.2} w={4.4} h={5.6} r={1.2} stroke={{ color: white, width: 1.5, dash: "1.6 1.3" }} />
        </>
      );
    case "jigsaw":
      return (
        <>
          <g transform="rotate(-10 7.5 12)">
            <Box x={3.2} y={6.2} w={8.6} h={11.6} r={2.3} fill={white} />
            <Line d="M5.6 12h3.8" color={edge} width={1.8} />
          </g>
          <g transform="rotate(9 16.5 12.5)">
            <Box x={12.2} y={6.7} w={8.6} h={11.6} r={2.3} fill={amber} />
            <Line d="M14.6 12.5h3.8" color={edge} width={1.8} />
          </g>
        </>
      );
    case "poet":
      return (
        <>
          <circle cx={10.5} cy={10} r={4.1} fill="none" stroke={ink} strokeWidth={2.1} />
          <Line d="M3.2 21c1.2-4 4-6 7.3-6s6.1 2 7.3 6" color={ink} />
          <circle cx={18.6} cy={5.6} r={4} fill={lapis} />
          <Line d="M17.3 4.7a1.4 1.4 0 1 1 2 1.3c-.5.2-.7.5-.7 1" color={white} width={1.4} />
          <circle cx={18.6} cy={8.1} r={0.7} fill={white} />
        </>
      );
    case "misra":
      return (
        <>
          <Line d="M20 7.5H6" color={ink} width={2.6} />
          <path d="M20 13H11" fill="none" stroke={ink} strokeWidth={2.1} strokeDasharray="2.4 2.6" />
          <Line d="M9 18.5H3.8M6.3 16l-2.5 2.5L6.3 21" color={white} width={2.3} />
        </>
      );
    case "book":
      return (
        <>
          <path d="M3.5 6.8c2.8-1.4 5.6-1.1 8.5.8v12c-2.9-1.9-5.7-2.2-8.5-.8z" fill={white} />
          <path d="M20.5 6.8c-2.8-1.4-5.6-1.1-8.5.8v12c2.9-1.9 5.7-2.2 8.5-.8z" fill={white} opacity={0.78} />
          <circle cx={12} cy={4.6} r={3.4} fill={amber} stroke={edge} strokeWidth={1.4} />
          <Line d="M11 3.9a1.1 1.1 0 1 1 1.5 1c-.4.2-.5.4-.5.8" color={ink} width={1.2} />
          <circle cx={12} cy={6.6} r={0.55} fill={ink} />
        </>
      );
    case "match":
      return (
        <>
          <Box x={13.5} y={4} w={7.5} h={5.2} r={2} fill={white} />
          <Box x={3} y={14.8} w={7.5} h={5.2} r={2} fill={white} />
          <g opacity={0.6}>
            <Box x={3} y={4} w={7.5} h={5.2} r={2} stroke={{ color: white, width: 1.6 }} />
            <Box x={13.5} y={14.8} w={7.5} h={5.2} r={2} stroke={{ color: white, width: 1.6 }} />
          </g>
          <Line d="M13.5 6.6c-4 0-0.5 10.8-3 10.8" color={green} width={2.3} />
        </>
      );
    case "listen":
      return (
        <>
          <Line d="M4.2 15v-3a7.8 7.8 0 0 1 15.6 0v3" color={white} />
          <Box x={3} y={14} w={4.6} h={6.6} r={1.9} fill={white} />
          <Box x={16.4} y={14} w={4.6} h={6.6} r={1.9} fill={white} />
          <Line d="M8.6 17.2c.9-2.2 1.8 2.2 2.7 0s1.8 2.2 2.7 0 1.8 2.2 2.7 0" color={magenta} width={1.9} />
        </>
      );
    case "mosh":
      return (
        <>
          <path d="M4 4.5h9.5a2 2 0 0 1 2 2v4.3a2 2 0 0 1-2 2H8.3l-3.1 2.7v-2.7H4a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z" fill={ink} />
          <path d="M11 11.6h9a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-.6v2.7l-3.1-2.7H11a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z" fill={white} stroke={ink} strokeWidth={1.2} />
          <Line d="M13.2 15.6h5" color={lapis} width={1.8} />
          <Line d="M6 8.6h5" color={edge} width={1.8} />
        </>
      );
    case "duel":
      return (
        <>
          <circle cx={5.8} cy={9.4} r={2.8} fill={white} />
          <path d="M1.8 19.5c.6-3 2.1-4.6 4-4.6s3.4 1.6 4 4.6z" fill={white} />
          <circle cx={18.2} cy={9.4} r={2.8} fill={white} />
          <path d="M14.2 19.5c.6-3 2.1-4.6 4-4.6s3.4 1.6 4 4.6z" fill={white} />
          <path d="M13.2 2.8L9.4 11.2h3.1l-1.2 7 4.4-9.4h-3.2z" fill={amber} stroke={ink} strokeWidth={1.1} />
        </>
      );
  }
}

export function GameGlyph({ kind, edge, size }: { kind: GameKind; edge: string; size: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      {parts(kind, edge)}
    </svg>
  );
}
