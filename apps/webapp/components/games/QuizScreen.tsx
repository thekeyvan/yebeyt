"use client";

import { useEffect, useState } from "react";
import { liveListenLoader, statsStore } from "../../lib/games/browser";
import type { GameCouplet, GameDeck } from "../../lib/games/couplet";
import { roundSeed } from "../../lib/games/debug";
import { listenQuestions } from "../../lib/games/listenLoader";
import { QuizRound } from "../../lib/games/quizRound";
import { bookRound, poetItemsRound, poetRound, secondRound } from "../../lib/games/quizRounds";
import { QuizSession } from "../../lib/games/quizSession";
import type { QuizKind } from "../../lib/games/quizQuestion";
import { SeededGenerator } from "../../lib/games/seeded";
import { useLoaded, useLibraryData } from "../../lib/library/browser";
import type { Library } from "../../lib/library/library";
import { LoadFailed } from "../library/WithLibrary";
import { GameLoading } from "./chrome";
import { useGame } from "./GameCover";
import { useRound } from "../play/RoundContext";
import { QuizPlay } from "./QuizPlay";
import { useRecitationFailed } from "./useListen";
import { WithDeck } from "./WithDeck";

/** The listen game asks Ganjoor for five poems' recitations; the others make their ten questions at once. */
const listenQuestionCount = 5;

async function makeRound(kind: QuizKind, deck: GameDeck, library: Library, poet: string | undefined, generator: SeededGenerator, items?: readonly GameCouplet[]): Promise<QuizRound | null> {
  switch (kind) {
    case "poet":
      return (items ? poetItemsRound(items, library.poets, generator) : poetRound(deck, library.poets, generator)) ?? null;
    case "misra":
      return secondRound(deck, poet, generator) ?? null;
    case "book":
      return bookRound(deck, library.books, generator) ?? null;
    case "listen":
      return QuizRound.of("listen", await listenQuestions(await liveListenLoader(), deck, listenQuestionCount, generator)) ?? null;
  }
}

/**
 * PlayPoet, PlaySecond, PlayBook and PlayListen: one question at a time with its options (Games/QuizScreen.swift). `poet` is the one a مصراع دوم round
 * is of (from a poet's page). A round that can't be made closes the game; گوش کن first says «خوانش باز نشد».
 */
export function QuizScreen({ kind, poet }: { kind: QuizKind; poet?: string }) {
  return <WithDeck wrap={(placeholder) => <GameLoading>{placeholder}</GameLoading>}>{(deck) => <Round deck={deck} kind={kind} poet={poet} />}</WithDeck>;
}

function Round({ deck, kind, poet }: { deck: GameDeck; kind: QuizKind; poet?: string }) {
  const game = useGame();
  const { answering } = useRound();
  const library = useLibraryData().value?.library;
  const seed = roundSeed();
  const { value: round, failed, retry } = useLoaded(
    async () => (library ? makeRound(kind, deck, library, poet, seed === undefined ? SeededGenerator.random() : new SeededGenerator(seed), answering?.items) : undefined),
    undefined,
    `${kind} ${poet} ${library !== undefined}`,
  );

  const nothing = round === null;
  useRecitationFailed(nothing && kind === "listen");
  useEffect(() => {
    if (nothing && kind !== "listen") game.leave();
  }, [nothing]);

  if (round) return <Started round={round} seed={seed} />;
  return <GameLoading>{failed ? <LoadFailed title="بازی باز نشد" onRetry={retry} /> : <div aria-busy className="h-[60dvh]" />}</GameLoading>;
}

function Started({ round, seed }: { round: QuizRound; seed?: bigint }) {
  const [session] = useState(() => new QuizSession(round, statsStore(), seed));
  return <QuizPlay session={session} />;
}
