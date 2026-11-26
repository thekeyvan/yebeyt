"use client";

import { useEffect, useState } from "react";
import { statsStore, useGameStats } from "../../lib/games/browser";
import type { GameDeck } from "../../lib/games/couplet";
import { DailySession } from "../../lib/games/dailySession";
import { pickPuzzle, type DailyPuzzle } from "../../lib/games/dailyPuzzle";
import { lettersOf } from "../../lib/games/letters";
import * as scoring from "../../lib/games/scoring";
import type { TehranDay } from "../../lib/games/tehranDay";
import { useStore } from "../../lib/library/browser";
import { useMediaQuery } from "../../lib/media";
import { persianDigits } from "../../lib/persian";
import { FlameIcon } from "../ui/icons";
import { Reaction } from "../ui/Reaction";
import { AnswerSheet } from "./AnswerSheet";
import { BigButton, Bulb, GameCloseButton, GameLoading, GamePage, RoundAction } from "./chrome";
import { DailyGrid, DailyKeyboard } from "./DailyBoard";
import { DailyCoupletCard } from "./DailyCoupletCard";
import { useGame } from "./GameCover";
import { GameIcon } from "./GameIcon";
import { WithDeck } from "./WithDeck";

/** How long the last row's colours are seen before the sheet comes. */
const sheetDelay = 900;

/** PlayDaily: the couplet with its blank, three tries, the letter keyboard and «بچسبون!». The same puzzle for everyone on a Tehran day; every try is kept, so coming back later finds the same state. */
export function DailyScreen() {
  return <WithDeck wrap={(placeholder) => <GameLoading>{placeholder}</GameLoading>}>{(deck) => <Today deck={deck} />}</WithDeck>;
}

function Today({ deck }: { deck: GameDeck }) {
  const stats = useGameStats();
  const day = stats.today;
  const puzzle = pickPuzzle(day, deck);
  return puzzle ? <Play key={day.number} puzzle={puzzle} day={day} /> : <GameLoading>{null}</GameLoading>;
}

function Streak({ days }: { days: number }) {
  return (
    <span aria-label={`رشته‌ی ${persianDigits(days)} روزه`} className="inline-flex items-center gap-1 rounded-pill border-[3px] border-white bg-fire px-[11px] py-1 text-[15px] font-bold leading-[1.4] text-white shadow-[0_2px_8px_rgba(20,17,43,0.18)]">
      <FlameIcon size={16} />
      {`${persianDigits(days)} روز`}
    </span>
  );
}

function Play({ puzzle, day }: { puzzle: DailyPuzzle; day: TehranDay }) {
  const stats = useGameStats();
  const game = useGame();
  const compact = useMediaQuery("(max-height: 699px)");
  const [session] = useState(() => new DailySession(puzzle, day, statsStore()));
  useStore(session);
  const { game: play } = session;
  const over = session.isOver;
  const [sheetShown, setSheetShown] = useState(over);

  useEffect(() => {
    if (!over || sheetShown) return;
    const timer = setTimeout(() => setSheetShown(true), sheetDelay);
    return () => clearTimeout(timer);
  }, [over, sheetShown]);

  // A physical keyboard types the same letters: Persian ones, Backspace to take one back and Enter for «بچسبون!».
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!game.active || sheetShown || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      const letters = event.key.length <= 2 ? lettersOf(event.key) : undefined;
      if (letters?.length === 1) session.type(letters[0]!);
      else if (event.key === "Backspace") session.erase();
      else if (event.key === "Enter" && !(event.target as HTMLElement).closest("button")) session.submit();
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game.active, sheetShown, session]);

  const solved = play.outcome === "solved";
  return (
    <>
      <div inert={sheetShown} className="h-full">
        <GamePage
          header={
            <div className="flex items-center gap-3">
              <GameCloseButton />
              <GameIcon kind="daily" size={44} />
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl leading-[1.3] text-ink">معمای امروز</h1>
                <p className="truncate text-xs text-muted">{`${day.line} · برای همه یکیه`}</p>
              </div>
              {stats.streak > 0 && <Streak days={stats.streak} />}
            </div>
          }
          bar={
            <div className="flex items-center gap-2.5">
              <BigButton onClick={() => session.submit()} disabled={!play.canSubmit} data-testid="submit" className="!h-[58px] !border-4 !text-[22px]">
                بچسبون!
              </BigButton>
              <RoundAction label={`یه حرف، ${persianDigits(scoring.dailyHintCost)} امتیاز`} amber onClick={() => session.hint()} disabled={!play.canHint}>
                <Bulb caption="یه حرف" />
              </RoundAction>
            </div>
          }
        >
          <div className={`flex flex-col ${compact ? "gap-2.5" : "gap-3.5"}`}>
            <DailyCoupletCard puzzle={puzzle} revealed={over} compact={compact} />
            <Reaction when={play.misses} effect="shake" className="block">
              <DailyGrid game={play} compact={compact} />
            </Reaction>
            <DailyKeyboard keys={puzzle.keys} marks={play.keyMarks} type={(letter) => session.type(letter)} erase={() => session.erase()} compact={compact} />
          </div>
        </GamePage>
      </div>
      {sheetShown && (
        <AnswerSheet
          couplet={puzzle.couplet}
          right={solved}
          title={solved ? undefined : "نه، این بود"}
          correction={puzzle.word}
          detail={solved ? `+${persianDigits(play.points)}` : undefined}
          buttonTitle="برگرد"
          next={game.requestClose}
          celebrates
        />
      )}
    </>
  );
}
