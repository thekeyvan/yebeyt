import { backgroundOf, type GameKind } from "../../lib/games/kinds";
import { GameGlyph } from "./GameGlyph";

/** A game's sticker: a coloured circle with a white border and the game's glyph; two colours are split on the diagonal, as the boards' `linear-gradient(135deg, a 50%, b 50%)` (Games/GameIcon.swift). */
export function GameIcon({ kind, size = 50 }: { kind: GameKind; size?: number }) {
  const [first, second] = backgroundOf(kind);
  const border = Math.max(2, Math.round(size / 12));
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-white"
      style={{ width: size, height: size, boxShadow: `0 2px ${Math.max(4, size / 8)}px rgba(20,17,43,0.2)` }}
    >
      <span className="grid place-items-center rounded-full" style={{ width: size - 2 * border, height: size - 2 * border, background: `linear-gradient(135deg, ${first} 50%, ${second ?? first} 50%)` }}>
        <GameGlyph kind={kind} edge={first} size={size * 0.56} />
      </span>
    </span>
  );
}
