"use client";

import { useEffect, useState } from "react";
import { optionState } from "../../lib/games/optionState";
import { subtitle } from "../../lib/games/quizCopy";
import { nameOf } from "../../lib/games/kinds";
import { rightHemistich, verdict } from "../../lib/games/quizQuestion";
import type { QuizAnswer, QuizRound } from "../../lib/games/quizRound";
import type { QuizSession } from "../../lib/games/quizSession";
import * as scoring from "../../lib/games/scoring";
import { quizSummary } from "../../lib/games/summary";
import { useLibraryData, useStore } from "../../lib/library/browser";
import { persianDigits } from "../../lib/persian";
import { SkipIcon } from "../ui/icons";
import { AnswerSheet } from "./AnswerSheet";
import { BigButton, Bulb, GameCloseButton, GamePage, RoundAction, ScoreSticker, TimerCapsule } from "./chrome";
import { useGame } from "./GameCover";
import { GameIcon } from "./GameIcon";
import { ListenCard } from "./ListenCard";
import { ProgressDots } from "./ProgressDots";
import { BookOption, HemistichOption, PoetOption, QuizCoupletCard } from "./QuizViews";
import { RoundEnd } from "./RoundEnd";
import { useListen, useRecitationFailed } from "./useListen";

/** «+۳۰ · ۷ ثانیه»; a wrong answer is not counted. */
function detail(answer: QuizAnswer, round: QuizRound): string {
  if (!answer.right) return "این یکی رو حساب نکردیم";
  const points = `+${persianDigits(answer.points)}`;
  return round.clock.kind === "none" ? points : `${points} · ${persianDigits(answer.seconds)} ثانیه`;
}

/** One question at a time with its options, «همینه!» to confirm, ۵۰:۵۰ (or «یه کلمه» in گوش کن), the clock of the game and the sheet after every answer. Nothing teaches while the clock runs: the meaning waits in the sheet. */
export function QuizPlay({ session }: { session: QuizSession }) {
  useStore(session);
  const game = useGame();
  const { round } = session;
  const listening = round.kind === "listen";
  const [failed, setFailed] = useState(false);
  const listen = useListen(session, () => setFailed(true));

  // The clock runs from the first second of a game that has one; it waits while the page is hidden and while the question «از بازی بری بیرون؟» is open.
  const timed = round.clock.kind !== "none";
  useEffect(() => {
    if (!timed) return;
    const timer = setInterval(() => session.tick(), 1000);
    const visibility = () => (session.isPaused = document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [session, timed]);
  useEffect(() => {
    session.isAsking = game.asking;
  }, [session, game.asking]);
  const asks = session.asksBeforeLeaving;
  useEffect(() => game.setAsks(asks), [game.setAsks, asks]);

  useRecitationFailed(failed);

  if (session.finished) return <RoundEnd summary={quizSummary(round)} />;
  const answer = round.lastAnswer;
  const question = round.current;
  return (
    <>
      <div inert={round.sheetOpen} className="h-full">
        <GamePage
          header={
            <div className="flex items-center gap-3">
              <GameCloseButton />
              <ProgressDots total={round.questions.length} results={round.results} sheetOpen={round.sheetOpen} noun="سؤال" />
              {session.timeText !== undefined && <TimerCapsule text={session.timeText} />}
            </div>
          }
          bar={
            <div className="flex items-center gap-2.5">
              <BigButton
                compact
                data-testid="confirm"
                disabled={round.selected === undefined || round.sheetOpen}
                onClick={() => session.confirm()}
              >
                همینه!
              </BigButton>
              {round.kind !== "book" && (
                <>
                  <RoundAction label="رد کن" testId="skip" onClick={() => session.skip()} disabled={!round.canSkip}>
                    <SkipIcon size={22} lineWidth={2.4} />
                  </RoundAction>
                  <RoundAction
                    amber
                    label={listening ? `یه کلمه، ${persianDigits(scoring.quizHintCost)} امتیاز` : `راهنما، ۵۰:۵۰، ${persianDigits(scoring.quizHintCost)} امتیاز`}
                    testId={listening ? "word" : "fifty"}
                    onClick={() => (listening ? session.showWord() : session.fifty())}
                    disabled={listening ? !round.canShowWord : !round.canFifty}
                  >
                    <Bulb caption={listening ? "یه کلمه" : "۵۰:۵۰"} />
                  </RoundAction>
                </>
              )}
            </div>
          }
        >
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center gap-3">
              <GameIcon kind={round.kind} size={50} />
              <div className="min-w-0 flex-1">
                <h1 className="text-[30px] leading-[1.3] text-ink">{nameOf(round.kind)}</h1>
                <p className="-mt-1 text-[13px] text-muted">{subtitle(round.kind, question.couplet.poetName)}</p>
              </div>
              <ScoreSticker points={round.points} />
            </div>
            <Question session={session} listen={listening ? listen : undefined} />
          </div>
        </GamePage>
      </div>
      {answer && (
        <AnswerSheet
          couplet={question.couplet}
          right={answer.right}
          title={verdict(question, answer.right)}
          correction={rightHemistich(question)}
          detail={detail(answer, round)}
          buttonTitle="سؤال بعدی"
          next={() => session.next()}
        />
      )}
    </>
  );
}

type Listen = ReturnType<typeof useListen>;

/** The couplet card and the options of the question in play. */
function Question({ session, listen }: { session: QuizSession; listen?: Listen }) {
  const { round } = session;
  const question = round.current;
  const library = useLibraryData().value?.library;
  const answered = round.sheetOpen;
  const props = (index: number) => ({ state: optionState(round, index), index, tap: () => session.select(index) });
  const hemistichs = (
    <div className="flex flex-col gap-2.5">
      {question.options.map((option, index) => (
        <HemistichOption key={option.id} {...props(index)} text={option.title} markedWord={round.wordShown && index === question.correct ? question.hintWord : undefined} />
      ))}
    </div>
  );
  switch (question.kind) {
    case "poet":
      return (
        <>
          <QuizCoupletCard couplet={question.couplet} />
          <div className="grid grid-cols-2 gap-3">
            {question.options.map((option, index) => (
              <PoetOption key={option.id} {...props(index)} poet={library?.poet(option.id)} name={option.title} />
            ))}
          </div>
        </>
      );
    case "misra":
      return (
        <>
          <QuizCoupletCard couplet={question.couplet} secondShown={answered} tag={question.couplet.poetName} />
          {hemistichs}
        </>
      );
    case "book":
      return (
        <>
          <QuizCoupletCard couplet={question.couplet} chip={library?.poet(question.couplet.poetSlug)} />
          <div className="flex items-start gap-3 px-1.5 pt-2">
            {question.options.map((option, index) => (
              <BookOption key={option.id} {...props(index)} book={library?.bookAt(option.id)} title={option.title} />
            ))}
          </div>
        </>
      );
    case "listen":
      return (
        <>
          {answered || !question.clip || !listen ? (
            <QuizCoupletCard couplet={question.couplet} />
          ) : (
            <ListenCard state={listen.view.state} progress={listen.view.progress} clip={question.clip} replaysLeft={round.replaysLeft} playOrPause={listen.playOrPause} replay={listen.replay} />
          )}
          {hemistichs}
        </>
      );
  }
}
