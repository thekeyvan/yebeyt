"use client";

import { allKinds, aboutOf, metaOf, nameOf, type GameKind } from "../../lib/games/kinds";
import type { Library } from "../../lib/library/library";
import { Screen } from "../shell/Screen";
import { ScreenHeader } from "../library/chrome";
import { WithLibrary } from "../library/WithLibrary";
import { GameIcon } from "./GameIcon";
import { GameLink } from "./GameLink";
import { GamePreview } from "./GamePreview";

function Card({ kind, library }: { kind: GameKind; library: Library }) {
  return (
    <GameLink
      kind={kind}
      label={`${nameOf(kind)}، ${metaOf(kind)}`}
      hint={aboutOf(kind)}
      testId={`catalog-${kind}`}
      className="flex flex-col gap-1.5 rounded-card bg-white p-2.5 text-start text-ink shadow-[0_3px_6px_rgba(20,17,43,0.08)]"
    >
      <GameIcon kind={kind} size={40} />
      <span>
        <span className="block pt-[3px] font-title text-[19px] leading-[1.3]">{nameOf(kind)}</span>
        <span className="block text-[10.5px] leading-[1.6] text-muted">{metaOf(kind)}</span>
      </span>
      <span className="mt-auto block pt-1">
        <GamePreview kind={kind} library={library} />
      </span>
    </GameLink>
  );
}

/** GamesCatalog: the nine games as a grid of cards, each with its sticker, name, line and a small picture of the game (Games/GamesCatalogScreen.swift). */
export function CatalogScreen() {
  return (
    <WithLibrary>
      {({ library }) => (
        <Screen header={<ScreenHeader title="بازی‌ها" fallback="/games" />}>
          <div className="grid grid-cols-3 gap-2.5 pt-1.5">
            {allKinds.map((kind) => (
              <Card key={kind} kind={kind} library={library} />
            ))}
          </div>
        </Screen>
      )}
    </WithLibrary>
  );
}
