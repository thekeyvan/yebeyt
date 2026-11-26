"use client";

import { useEffect, useState } from "react";
import { statsStore } from "../../lib/games/browser";
import type { GameDeck } from "../../lib/games/couplet";
import { roundSeed } from "../../lib/games/debug";
import { slotAt } from "../../lib/games/drop";
import { attemptWords } from "../../lib/games/jigsawBoard";
import { comboLength, JigsawRound } from "../../lib/games/jigsawRound";
import { JigsawSession } from "../../lib/games/jigsawSession";
import * as scoring from "../../lib/games/scoring";
import { SeededGenerator } from "../../lib/games/seeded";
import { jigsawSummary } from "../../lib/games/summary";
import { useStore } from "../../lib/library/browser";
import { persianDigits } from "../../lib/persian";
import { CheckIcon, ShuffleIcon } from "../ui/icons";
import { AnswerSheet } from "./AnswerSheet";
import { BigButton, Bulb, GameCloseButton, GameLoading, GamePage, RoundAction, ScoreSticker, TimerCapsule } from "./chrome";
import { useGame } from "./GameCover";
import { JigsawCard } from "./JigsawCard";
import { ProgressDots } from "./ProgressDots";
import { RoundEnd } from "./RoundEnd";
import { StickerSheet } from "./StickerSheet";
import { WithDeck } from "./WithDeck";

/** JigsawE: ten couplets in two minutes. The first hemistich is whole, the second is word slots; stickers from the sheet go into them. Nothing teaches while the clock runs: the meaning waits in the sheet after each answer. */
export function JigsawScreen() {
  return <WithDeck wrap={(placeholder) => <GameLoading>{placeholder}</GameLoading>}>{(deck) => <Round deck={deck} />}</WithDeck>;
}

function Round({ deck }: { deck: GameDeck }) {
  const [session] = useState(() => {
    const seed = roundSeed();
    const round = JigsawRound.make([], deck, seed === undefined ? SeededGenerator.random() : new SeededGenerator(seed));
    return round && new JigsawSession(round, statsStore(), seed);
  });
  return session ? <Play session={session} /> : <GameLoading>{null}</GameLoading>;
}

function Play({ session }: { session: JigsawSession }) {
  useStore(session);
  const game = useGame();
  const { round } = session;
  const { board } = round;

  // The clock runs from the first second; it waits while the page is hidden and while the question «از بازی بری بیرون؟» is open.
  useEffect(() => {
    const timer = setInterval(() => session.tick(), 1000);
    const visibility = () => (session.isPaused = document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [session]);
  useEffect(() => {
    session.isAsking = game.asking;
  }, [session, game.asking]);
  const asks = session.asksBeforeLeaving;
  useEffect(() => game.setAsks(asks), [game.setAsks, asks]);

  if (session.finished) return <RoundEnd summary={jigsawSummary(round)} />;

  function drop(sticker: { id: number; word: string }, point: { x: number; y: number }) {
    const frames = [...document.querySelectorAll<HTMLElement>("[data-drop]")].map((element) => ({ position: Number(element.dataset.drop), rect: element.getBoundingClientRect() }));
    const position = slotAt(point, frames);
    if (position !== undefined) session.edit((current) => current.place(sticker, position));
  }

  const answer = round.lastAnswer;
  return (
    <>
      <div inert={round.sheetOpen} className="h-full">
        <GamePage
          header={
            <div className="flex items-center gap-3">
              <GameCloseButton />
              <ProgressDots total={round.questions.length} results={round.answers.map((a) => a.result.isRight)} sheetOpen={round.sheetOpen} />
              <TimerCapsule text={session.timeText} />
            </div>
          }
          bar={
            <div className="flex items-center gap-3">
              <RoundAction label={`راهنما، ${persianDigits(scoring.jigsawHintCost)} امتیاز`} amber onClick={() => session.edit((current) => current.hint())} disabled={!board.canHint}>
                <Bulb caption={`−${persianDigits(scoring.jigsawHintCost)}`} />
              </RoundAction>
              <RoundAction label="بُر زدن برچسب‌ها" onClick={() => session.shuffle()}>
                <ShuffleIcon size={22} lineWidth={2.4} />
              </RoundAction>
              <BigButton onClick={() => session.check()} disabled={!board.isFull} data-testid="check">
                بچسبون!
              </BigButton>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center">
              <div className="flex-1">
                <h1 className="text-[32px] leading-[1.3] text-ink">جورچین بیت</h1>
                <p className="text-[15px] text-muted">برچسب‌ها رو بکَن، بچسبون سر جاشون</p>
              </div>
              <ScoreSticker points={round.points} />
            </div>
            <JigsawCard board={board} revealed={round.sheetOpen} tap={(position) => session.edit((current) => current.tapSlot(position))} />
            <p
              data-testid="combo"
              aria-hidden={round.combo < comboLength}
              className={`flex items-center gap-1.5 self-center rounded-pill border-4 border-white bg-green px-3.5 py-1 text-sm font-bold text-ink shadow-[0_2px_6px_rgba(20,17,43,0.2)] ${round.combo >= comboLength && !round.sheetOpen ? "" : "opacity-0"}`}
            >
              <CheckIcon size={16} lineWidth={2.8} />
              سه تا پشت سر هم درست!
            </p>
            <StickerSheet
              stickers={board.onSheet}
              selected={board.selected}
              extras={round.current.stickers.length - round.current.missing.length}
              select={(sticker) => session.edit((current) => current.select(sticker))}
              drop={drop}
            />
          </div>
        </GamePage>
      </div>
      {answer && (
        <AnswerSheet
          couplet={round.current.couplet}
          right={answer.result.isRight}
          title={answer.result.isRight ? undefined : "نه، این بود"}
          attempt={attemptWords(board)}
          correction={round.current.couplet.m2}
          detail={`+${persianDigits(answer.result.points)} · ${persianDigits(answer.seconds)} ثانیه`}
          buttonTitle="بیت بعدی"
          next={() => session.next()}
        />
      )}
    </>
  );
}
