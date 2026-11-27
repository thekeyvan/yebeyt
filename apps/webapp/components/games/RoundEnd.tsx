"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { sourceOf } from "../../lib/games/couplet";
import { useDeck } from "../../lib/games/browser";
import { celebrates, type RoundSummary } from "../../lib/games/summary";
import { plain } from "../../lib/library/normalize";
import { persianDigits } from "../../lib/persian";
import { isInDeck } from "../../lib/play/challengeOffer";
import { routeURL } from "../../lib/reader/route";
import { useStore } from "../../lib/library/browser";
import { useServices } from "../account/useServices";
import { ChallengeSendCard } from "../play/ChallengeSendCard";
import { useRound } from "../play/RoundContext";
import { RoundButton } from "../library/chrome";
import { CheckIcon, ChevronRightIcon, CloseIcon } from "../ui/icons";
import { CountUp, Reaction } from "../ui/Reaction";
import { GamePage } from "./chrome";
import { useGame } from "./GameCover";

/** Green ✓ for a right couplet, red × for a wrong one, a grey dot for one the time ran out before. */
function Result({ result }: { result: boolean | null }) {
  if (result === null) return <span role="img" aria-label="نرسیدی" className="grid size-7 shrink-0 place-items-center"><span className="size-3.5 rounded-full bg-track-light" /></span>;
  return (
    <span role="img" aria-label={result ? "درست" : "نشد"} className={`grid size-7 shrink-0 place-items-center rounded-full ${result ? "bg-green text-ink" : "bg-fire text-white"}`}>
      {result ? <CheckIcon size={16} lineWidth={3} /> : <CloseIcon size={12} lineWidth={3.2} />}
    </span>
  );
}

/** The round's couplets as rows that open the reader, with a mark for each (and, in رودررو, its meaning). */
function Couplets({ summary }: { summary: RoundSummary }) {
  return (
    <ul className="flex flex-col gap-2">
      {summary.rows.map(({ couplet, result }) => (
        <li key={`${couplet.poem}#${couplet.index}`}>
          <Link href={routeURL(couplet.poem, couplet.index, "couplet")} prefetch={false} data-testid="round-couplet" className="flex items-center gap-3 rounded-[20px] bg-white px-3.5 py-2.5 shadow-[0_2px_4px_rgba(20,17,43,0.05)]">
            <Result result={result} />
            <span className="flex min-w-0 flex-1 flex-col text-ink">
              <span className="font-poem text-base leading-[1.8]">{plain(couplet.m1)}</span>
              <span className="font-poem text-base leading-[1.8]">{plain(couplet.m2)}</span>
              <span className="pt-1 text-[11px] text-[#8A8698]">{sourceOf(couplet)}</span>
              {summary.showsMeanings && couplet.meaning && <span className="pt-0.5 text-xs text-muted">{couplet.meaning}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * ChallengeSend for every game (Games/RoundEndScreen.swift): the points, «n از ۱۰», and then the challenge card (جورچین and حدس شاعر, for a signed-in person), a card
 * of the caller's (the result of a challenge) or the round's couplets as rows that open the reader. The score and the points count up, and a round with at least half
 * right (a game won) gets the big confetti.
 */
export function RoundEnd({ summary, card }: { summary: RoundSummary; card?: ReactNode }) {
  const { requestClose } = useGame();
  const wins = celebrates(summary);
  const services = useServices();
  const signedIn = useStore(services?.session)?.status === "in";
  const deck = useDeck().value;
  const { invite } = useRound();
  const offer = signedIn && summary.offer && deck && isInDeck(summary.offer, deck) ? { ...summary.offer, invite: [...invite] } : undefined;
  return (
    <GamePage
      header={
        <div className="flex items-center">
          <RoundButton label="برگشت" onClick={requestClose}>
            <ChevronRightIcon size={20} lineWidth={2.6} />
          </RoundButton>
          {summary.showsPoints !== false && (
            <span
              data-testid="round-end-points"
              aria-label={`+${persianDigits(summary.points)} امتیاز`}
              className="ms-auto rounded-pill border-[3px] border-white bg-amber px-3 pt-1 pb-0.5 font-title text-base leading-[1.5] text-ink shadow-[0_2px_6px_rgba(20,17,43,0.18)]"
            >
              <CountUp value={summary.points} prefix="+" suffix=" امتیاز" />
            </span>
          )}
        </div>
      }
    >
      <div data-testid="round-end" className="flex flex-col gap-3.5">
        <div className="flex items-center gap-4 px-1 pt-1">
          <Reaction onAppear effect={wins ? "wiggle" : "pop"} burst={wins ? "win" : undefined} big className="-rotate-6">
            <span
              data-testid="round-end-score"
              role="img"
              aria-label={`${persianDigits(summary.right)} از ${persianDigits(summary.total)}`}
              className="flex size-[86px] flex-col items-center justify-center rounded-full border-[5px] border-white bg-lapis text-white shadow-[0_6px_16px_rgba(20,17,43,0.3)]"
            >
              <span className="h-10 pt-1.5 font-title text-[40px] leading-10">
                <CountUp value={summary.right} />
              </span>
              <span className="text-xs font-bold">{`از ${persianDigits(summary.total)}`}</span>
            </span>
          </Reaction>
          <div className="min-w-0 flex-1">
            <h1 data-testid="round-end-title" className="text-[28px] leading-[1.3] text-ink">
              {summary.title}
            </h1>
            <p className="text-[13px] text-muted">{summary.subtitle}</p>
          </div>
        </div>
        {offer ? (
          <ChallengeSendCard offer={offer} />
        ) : (
          <>
            {card}
            <Couplets summary={summary} />
          </>
        )}
      </div>
    </GamePage>
  );
}
