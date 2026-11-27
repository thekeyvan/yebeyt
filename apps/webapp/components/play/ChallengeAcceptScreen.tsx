"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Services } from "../../lib/account/services";
import { useDeck } from "../../lib/games/browser";
import { nameOf } from "../../lib/games/kinds";
import { useLibraryData, useStore } from "../../lib/library/browser";
import { ChallengeAccept, coupletsOf } from "../../lib/play/challengeModels";
import { playCopy } from "../../lib/play/copy";
import { playerName, type Challenge } from "../../lib/play/models";
import { useServices } from "../account/useServices";
import { FacePerson } from "../friends/FacePerson";
import { BigButton, GameCloseButton, GameLoading, GamePage } from "../games/chrome";
import { useGame } from "../games/GameCover";
import { JigsawScreen } from "../games/JigsawScreen";
import { QuizScreen } from "../games/QuizScreen";
import { RoundButton } from "../library/chrome";
import { ChevronRightIcon } from "../ui/icons";
import { RoundContext } from "./RoundContext";

/**
 * ChallengeAccept: the board of a challenge opened by its link, with or without an account (Play/ChallengeAcceptScreen.swift). It plays exactly the maker's ten
 * couplets, then posts the result (a guest gives a name first).
 */
export function ChallengeAcceptScreen({ code }: { code: string }) {
  const services = useServices();
  return services ? <Accept services={services} code={code} /> : <GameLoading>{null}</GameLoading>;
}

function Accept({ services, code }: { services: Services; code: string }) {
  const [accept] = useState(() => new ChallengeAccept(code, services.api, () => services.session.isSignedIn && Boolean(services.session.user?.username)));
  const phase = useStore(accept)!;
  const deck = useDeck().value;
  const library = useLibraryData().value?.library;
  const [playing, setPlaying] = useState(false);
  useEffect(() => void accept.load(), [accept]);

  if (phase.kind === "failed") return <Failure line={phase.line} retry={() => void accept.load()} />;
  if (phase.kind === "loading" || !deck || !library) return <GameLoading><div aria-busy className="h-[60dvh]" /></GameLoading>;
  const { challenge } = phase;
  const items = coupletsOf(challenge, deck, new Set(library.poets.map((poet) => poet.slug)));
  if (!items) return <Failure line={playCopy.challengeNotOpened} retry={() => void accept.load()} />; // never a round made of other couplets
  if (!playing) return <Board challenge={challenge} asksName={accept.asksName} start={() => setPlaying(true)} />;
  return (
    <RoundContext value={{ invite: [], answering: { accept, challenge, items } }}>
      {challenge.game === "jigsaw" ? <JigsawScreen start={{ kind: "deck" }} /> : <QuizScreen kind="poet" />}
    </RoundContext>
  );
}

function Failure({ line, retry }: { line: string; retry: () => void }) {
  return (
    <GamePage header={<GameCloseButton />}>
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3.5">
        <p data-testid="challenge-failed" className="text-center text-[15px] text-muted">
          {line}
        </p>
        <button type="button" onClick={retry} className="text-sm font-bold text-lapis">
          دوباره
        </button>
      </div>
    </GamePage>
  );
}

const chip = (text: string): ReactNode => (
  <span key={text} className="rounded-full bg-white px-3 py-[5px] text-xs font-medium text-ink">
    {text}
  </span>
);

function Board({ challenge, asksName, start }: { challenge: Challenge; asksName: boolean; start: () => void }) {
  const { requestClose } = useGame();
  const name = playerName(challenge.creator);
  return (
    <GamePage
      header={
        <div className="flex items-center">
          <RoundButton label="برگشت" onClick={requestClose}>
            <ChevronRightIcon size={20} lineWidth={2.6} />
          </RoundButton>
          <span className="ms-auto text-xs text-muted">{playCopy.fromLink(name)}</span>
        </div>
      }
    >
      <div data-testid="challenge-accept" className="flex flex-col items-center gap-3.5 pt-3">
        <div className="relative pt-1">
          <FacePerson parts={challenge.creator.avatar} size={104} />
          <span className="absolute -bottom-1.5 -start-2.5 -rotate-[8deg] rounded-pill border-[3px] border-white bg-fire px-2.5 pt-0.5 font-title text-[15px] leading-[1.5] text-white shadow-[0_2px_6px_rgba(20,17,43,0.2)]">
            {playCopy.outOfTen(challenge.score)}
          </span>
        </div>
        <h1 data-testid="challenge-title" className="text-center text-[30px] leading-[1.3] text-ink">
          {playCopy.waitingForYou(name)}
        </h1>
        <p className="text-center text-sm leading-[2] text-muted">
          {playCopy.sameTen}
          <br />
          {playCopy.toWin(challenge.score)}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {[nameOf(challenge.game), ...(challenge.label ? [challenge.label] : []), playCopy.aboutTwoMinutes].map(chip)}
        </div>
        <BigButton className="mt-2 text-2xl" onClick={start} data-testid="challenge-start">
          شروع کن
        </BigButton>
        {asksName && (
          <div data-testid="challenge-no-account" className="flex w-full flex-col gap-2 rounded-[20px] bg-white px-3.5 py-3 shadow-[0_2px_4px_rgba(20,17,43,0.06)]">
            <p className="text-[13px] font-bold text-ink">{playCopy.noAccount}</p>
            <p className="text-[12.5px] leading-[1.8] text-muted">{playCopy.noAccountNote(name)}</p>
          </div>
        )}
      </div>
    </GamePage>
  );
}
