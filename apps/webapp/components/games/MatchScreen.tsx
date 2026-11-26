"use client";

import { useEffect, useState } from "react";
import { loadMatchRound, statsStore } from "../../lib/games/browser";
import { roundSeed } from "../../lib/games/debug";
import { nameOf } from "../../lib/games/kinds";
import type { MatchRound } from "../../lib/games/matchRound";
import { MatchSession } from "../../lib/games/matchSession";
import * as scoring from "../../lib/games/scoring";
import { SeededGenerator } from "../../lib/games/seeded";
import { matchSummary } from "../../lib/games/summary";
import { useLoaded, useStore } from "../../lib/library/browser";
import { persianDigits } from "../../lib/persian";
import { AnswerSheet } from "./AnswerSheet";
import { GameCloseButton, GameLoading, GamePage, ScoreSticker } from "./chrome";
import { useGame } from "./GameCover";
import { GameIcon } from "./GameIcon";
import { MatchBoard, MatchCoupletCard } from "./MatchViews";
import { ProgressDots } from "./ProgressDots";
import { RoundEnd } from "./RoundEnd";

/** The sheet comes a moment after the last pair, long enough to see it join. */
const sheetDelay = 800;
/** A meaning tapped wrong stays red this long. */
const wrongFor = 700;

/** PlayMatch: the couplet with its hard words dotted, the words in one column and their meanings, shuffled, in the other. Tap a word, then its meaning: a right pair turns green and is joined by a curve; a wrong meaning only shakes. No clock; 10 points for each pair (Games/MatchScreen.swift). */
export function MatchScreen() {
  const game = useGame();
  const { value: round, failed } = useLoaded(() => loadMatchRound(roundGenerator()));
  const nothing = round === null || failed;
  useEffect(() => {
    if (nothing) game.leave();
  }, [nothing]);
  return round ? <Started round={round} /> : <GameLoading><div aria-busy className="h-[60dvh]" /></GameLoading>;
}

const roundGenerator = (): SeededGenerator => {
  const seed = roundSeed();
  return seed === undefined ? SeededGenerator.random() : new SeededGenerator(seed);
};

function Started({ round }: { round: MatchRound }) {
  const [session] = useState(() => new MatchSession(round, statsStore()));
  return <Play session={session} />;
}

function Play({ session }: { session: MatchSession }) {
  useStore(session);
  const game = useGame();
  const { round } = session;
  const [shakes, setShakes] = useState<Record<number, number>>({});
  const [wrongMeaning, setWrongMeaning] = useState<number>();
  const [sheetShown, setSheetShown] = useState(round.sheetOpen);
  const asks = session.asksBeforeLeaving;
  useEffect(() => game.setAsks(asks), [game.setAsks, asks]);

  useEffect(() => {
    if (!round.sheetOpen) return setSheetShown(false);
    const timer = setTimeout(() => setSheetShown(true), sheetDelay);
    return () => clearTimeout(timer);
  }, [round.sheetOpen, round.index]);

  useEffect(() => {
    if (wrongMeaning === undefined) return;
    const timer = setTimeout(() => setWrongMeaning(undefined), wrongFor);
    return () => clearTimeout(timer);
  }, [wrongMeaning, shakes]);

  if (session.finished) return <RoundEnd summary={matchSummary(round)} />;

  function pick(meaning: number) {
    if (session.pick(meaning) !== "wrong") return;
    setShakes((before) => ({ ...before, [meaning]: (before[meaning] ?? 0) + 1 }));
    setWrongMeaning(meaning);
  }

  return (
    <>
      <div inert={sheetShown} className="h-full">
        <GamePage
          header={
            <div className="flex items-center gap-3">
              <GameCloseButton />
              <ProgressDots total={round.current.words.length} results={Array.from(round.matched, () => true)} sheetOpen={round.sheetOpen} noun="جفت" />
            </div>
          }
        >
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center gap-3">
              <GameIcon kind="match" size={50} />
              <div className="min-w-0 flex-1">
                <h1 className="text-[30px] leading-[1.3] text-ink">{nameOf("match")}</h1>
                <p className="-mt-1 text-[13px] text-muted">هر واژه رو به معنیش وصل کن</p>
              </div>
              <ScoreSticker points={round.points} />
            </div>
            <MatchCoupletCard question={round.current} />
            <MatchBoard round={round} shakes={shakes} wrongMeaning={wrongMeaning} selectWord={(id) => session.selectWord(id)} pick={pick} />
            <p className="text-center text-xs text-muted">واژه رو بزن، بعد معنیش رو. اشتباه کنی، فقط قرمز می‌شه و تکون می‌خوره.</p>
          </div>
        </GamePage>
      </div>
      {sheetShown && (
        <AnswerSheet
          couplet={round.current.couplet}
          right
          title="آره، همینه!"
          detail={`+${persianDigits(round.current.words.length * scoring.matchPair)}`}
          buttonTitle="سؤال بعدی"
          next={() => session.next()}
        />
      )}
    </>
  );
}
