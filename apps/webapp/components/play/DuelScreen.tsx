"use client";

import { useEffect } from "react";
import type { Services } from "../../lib/account/services";
import { useLibraryData, useStore } from "../../lib/library/browser";
import { persianClock } from "../../lib/persian";
import { playCopy } from "../../lib/play/copy";
import { otherThan, playerName, playerOf } from "../../lib/play/models";
import { GameCloseButton, GameLoading, GamePage } from "../games/chrome";
import { useGame } from "../games/GameCover";
import { GameIcon } from "../games/GameIcon";
import { RoundEnd } from "../games/RoundEnd";
import { DuelQuestion } from "./DuelQuestion";
import { DuelScore } from "./DuelScore";
import { useNow } from "./useNow";
import { useSignedInServices } from "./useGuarded";

const kindTitle = { second: "مصراع دوم", poet: "حدس شاعر", book: "از کدوم کتاب؟" } as const;

/**
 * PlayDuel: five rounds, eight seconds each, one question at a time over the live socket. The first right answer wins the round; a wrong one locks me out of it. After
 * round five the rounds come with their couplets and meanings (Play/DuelScreen.swift). A socket that was lost comes back by itself, and the server asks the open round
 * again with the time that is left.
 */
export function DuelScreen({ gameId }: { gameId: string }) {
  const services = useSignedInServices();
  return services ? <Duel services={services} gameId={gameId} /> : <GameLoading>{null}</GameLoading>;
}

function Duel({ services, gameId }: { services: Services; gameId: string }) {
  const { games } = services;
  useStore(games);
  const { setAsks } = useGame();
  const library = useLibraryData().value?.library;
  const now = useNow(250);
  useEffect(() => void games.load(gameId), [games, gameId]);

  const me = games.me;
  const game = games.game(gameId);
  const other = me && game ? otherThan(game, me) : undefined;
  const state = games.duel(gameId);
  const otherName = other ? playerName(other) : "";
  const playing = Boolean(state?.question) && !state?.isEnded;
  // A game that has started is not left without asking: the other player is left alone in it.
  useEffect(() => setAsks(playing), [setAsks, playing]);

  const summary = state?.isEnded ? state.summary(otherName, (slug) => library?.poet(slug)?.name ?? slug) : undefined;
  if (summary) return <RoundEnd summary={summary} />;
  if (!game || !me) return <GameLoading>{null}</GameLoading>;

  const question = state?.question;
  return (
    <GamePage
      header={
        <div className="flex items-center gap-2.5">
          <GameCloseButton />
          <GameIcon kind="duel" size={40} />
          <h1 className="flex-1 pt-[3px] text-[22px] leading-[1.3] text-ink">بازی رودررو</h1>
          {state && question && (
            <span role="timer" aria-label="زمان" data-testid="duel-time" className="rounded-full border-[3px] border-white bg-fire px-3 py-[5px] text-[15px] font-bold leading-none text-white shadow-[0_2px_4px_rgba(20,17,43,0.18)]">
              {persianClock(state.secondsLeft(now))}
            </span>
          )}
        </div>
      }
    >
      <div data-testid="duel" className="flex min-h-full flex-col gap-3.5 pb-4">
        {game.status === "waiting" ? (
          <Message text={playCopy.waiting("")} detail={playCopy.gameLink(game.code)} />
        ) : state && question ? (
          <>
            <DuelScore state={state} myParts={playerOf(game, me)?.avatar ?? null} otherParts={other?.avatar ?? null} otherName={otherName} />
            <span data-testid="duel-kind" className="self-center rounded-full bg-ink px-3.5 py-1 text-xs font-bold text-white">{`این دور: ${kindTitle[question.kind]}`}</span>
            <DuelQuestion question={question} state={state} library={library} choose={(index) => games.answer(index, gameId)} />
            <p data-testid="duel-footer" className={`mt-auto text-center text-xs text-muted ${state.isRoundOver ? "font-bold" : ""}`}>
              {state.isRoundOver ? playCopy.duelRound(state.roundWinner, state.me, otherName) : "هر کی زودتر درست جواب بده، دور رو می‌بره. بعد از بازی، معنی همه‌ی بیت‌ها رو با هم می‌بینید."}
            </p>
          </>
        ) : (
          <Message text={playCopy.duelWaiting(otherName)} />
        )}
      </div>
    </GamePage>
  );
}

function Message({ text, detail }: { text: string; detail?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 pt-24">
      <p data-testid="duel-waiting" className="text-[26px] text-ink">
        {text}
      </p>
      {detail && (
        <p dir="ltr" className="text-[13px] font-bold text-lapis">
          {detail}
        </p>
      )}
    </div>
  );
}
