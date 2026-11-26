import { backgroundOf, nameOf, taglineOf, type GameKind } from "../../lib/games/kinds";
import { GameIcon } from "./GameIcon";
import { GameLink } from "./GameLink";

/** A game on the tab: its colour, name and a few words, with its sticker at the corner (Games/GamesView.swift `GameCard`). */
export function GameCard({ kind }: { kind: GameKind }) {
  const tagline = taglineOf(kind);
  return (
    <GameLink
      kind={kind}
      label={nameOf(kind)}
      testId={`game-${kind}`}
      className="relative flex h-[102px] flex-col justify-end rounded-[24px] border-[5px] border-white px-3 py-2.5 text-start text-ink shadow-card"
      style={{ backgroundColor: backgroundOf(kind)[0] }}
    >
      <span className="truncate font-title text-[22px] leading-[1.4]">{nameOf(kind)}</span>
      {tagline && <span className="text-xs font-medium leading-[1.5]">{tagline}</span>}
      <span className="absolute -top-3.5 end-2">
        <GameIcon kind={kind} />
      </span>
    </GameLink>
  );
}
