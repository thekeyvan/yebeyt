"use client";

import { useEffect, useState, type ReactNode } from "react";
import { statsStore } from "../../lib/games/browser";
import type { GameDeck } from "../../lib/games/couplet";
import { roundSeed } from "../../lib/games/debug";
import { slotAt } from "../../lib/games/drop";
import { SeededGenerator } from "../../lib/games/seeded";
import type { OnboardingModel } from "../../lib/onboarding/model";
import { OnboardingGame, onboardingReward } from "../../lib/onboarding/game";
import type { Taste } from "../../lib/onboarding/taste";
import type { ScoreSync } from "../../lib/account/scoreSync";
import { useStore } from "../../lib/library/browser";
import { GameIcon } from "../games/GameIcon";
import { JigsawCard } from "../games/JigsawCard";
import { StickerSheet } from "../games/StickerSheet";
import { WithDeck } from "../games/WithDeck";
import { OnbButton, OnbScreen, OnbTopBar } from "./chrome";

/** How long the red stickers stay, long enough to see which words were wrong. */
const wrongMs = 1100;
/** A won game shows the stuck couplet for a moment first. */
const wonMs = 900;

type Props = { onboarding: OnboardingModel; taste: Taste; scores: ScoreSync };

function Play({ deck, onboarding, taste, scores }: Props & { deck: GameDeck }) {
  const [game] = useState(() => {
    const seed = roundSeed();
    return OnboardingGame.make(deck, taste.poets, seed === undefined ? SeededGenerator.random() : new SeededGenerator(seed));
  });
  useStore(game);
  const [announcement, setAnnouncement] = useState("");

  // The clock runs from the first second; with no couplet to play it is on to the account step.
  useEffect(() => {
    if (!game) return onboarding.next();
    const timer = setInterval(() => game.tick(), 1000);
    return () => clearInterval(timer);
  }, [game, onboarding]);

  const showsWrong = game?.showsWrong;
  useEffect(() => {
    if (!showsWrong || !game) return;
    setAnnouncement("نشد");
    const timer = setTimeout(() => game.clearWrong(), wrongMs);
    return () => clearTimeout(timer);
  }, [showsWrong, game]);

  const outcome = game?.outcome;
  useEffect(() => {
    if (!outcome) return;
    const finish = () => onboarding.gameEnded(outcome === "won");
    if (outcome !== "won") return finish();
    // Winning earns +۵۰, kept for the account and, for the sign-in that follows, sent to it.
    statsStore().award(onboardingReward);
    scores.report("onboarding", onboardingReward, true);
    const timer = setTimeout(finish, wonMs);
    return () => clearTimeout(timer);
  }, [outcome, onboarding, scores]);

  function drop(sticker: { id: number; word: string }, point: { x: number; y: number }) {
    const frames = [...document.querySelectorAll<HTMLElement>("[data-drop]")].map((element) => ({ position: Number(element.dataset.drop), rect: element.getBoundingClientRect() }));
    const position = slotAt(point, frames);
    if (position !== undefined) game?.edit((board) => board.place(sticker, position));
  }

  return (
    <OnbScreen
      step="game"
      header={<OnbTopBar step="game" skip={() => onboarding.next()} />}
      footer={
        <OnbButton disabled={!game || !game.board.isFull || game.showsWrong || game.isOver} onClick={() => game?.check()} testId="onb-check">
          بچسبون!
        </OnbButton>
      }
    >
      {(compact) => (
        <div className={`flex flex-col ${compact ? "gap-2.5" : "gap-4"}`}>
          <div className={`flex items-center gap-3 ${compact ? "pb-2" : ""}`}>
            <GameIcon kind="jigsaw" size={compact ? 44 : 50} />
            <div className="flex flex-1 flex-col gap-0.5">
              <h1 className="font-title text-[28px] leading-[1.3] text-ink">اولین بیتت رو بچسبون</h1>
              <p className="text-[13px] text-muted">برچسب‌ها رو بکن و به ترتیب بچسبون. ۳۰ ثانیه.</p>
            </div>
          </div>
          {game && (
            <>
              <JigsawCard board={game.board} revealed={game.outcome === "won" || game.showsWrong} tap={(position) => game.edit((board) => board.tapSlot(position))} />
              <p data-testid="onb-progress" className="self-center rounded-pill border-[3px] border-white bg-green px-3.5 py-1 text-[13px] font-bold text-ink shadow-[0_2px_6px_rgba(20,17,43,0.2)]">
                {game.progressLine}
              </p>
              <StickerSheet
                stickers={game.board.onSheet}
                selected={game.board.selected}
                extras={game.board.question.stickers.length - game.board.question.missing.length}
                select={(sticker) => game.edit((board) => board.select(sticker))}
                drop={drop}
              />
            </>
          )}
          <p role="status" aria-live="assertive" className="sr-only">
            {announcement}
          </p>
        </div>
      )}
    </OnbScreen>
  );
}

/** OnbGame: the first couplet to stick, in 30 seconds. It is جورچین بیت with one couplet, drawn with the game's own card and sticker sheet. Winning earns +۵۰; running out of time just goes on to the account step (Onboarding/OnbGameView.swift). */
export function OnbGame(props: Props) {
  const waiting = (placeholder: ReactNode) => (
    <OnbScreen step="game" header={<OnbTopBar step="game" skip={() => props.onboarding.next()} />} footer={<OnbButton disabled onClick={() => {}} testId="onb-check">بچسبون!</OnbButton>}>
      {() => placeholder}
    </OnbScreen>
  );
  return <WithDeck wrap={waiting}>{(deck) => <Play deck={deck} {...props} />}</WithDeck>;
}
