"use client";

import { useEffect, useState } from "react";
import { feedbackPrivate } from "../../lib/feedbackPrivate";
import type { RoundSummary } from "../../lib/games/summary";
import { nameMaxLength, outcomeOf } from "../../lib/play/challengeModels";
import { playCopy } from "../../lib/play/copy";
import { playerName } from "../../lib/play/models";
import { BigButton } from "../games/chrome";
import { RoundEnd } from "../games/RoundEnd";
import type { ChallengeAnswer } from "./RoundContext";

type Phase = "starting" | "naming" | "sending" | "done" | "failed";

const card = "flex flex-col gap-2.5 rounded-[26px] bg-white p-4 shadow-[0_3px_6px_rgba(20,17,43,0.08)]";

/**
 * The end of a challenge being answered: the result is posted (at once with an account; a guest gives a name first), then the two scores and who won
 * (Play/ChallengeAcceptScreen.swift `ChallengeEndScreen`).
 */
export function ChallengeEnd({ answering, summary }: { answering: ChallengeAnswer; summary: RoundSummary }) {
  const { accept, challenge } = answering;
  const [phase, setPhase] = useState<Phase>("starting");
  const [name, setName] = useState("");
  const [line, setLine] = useState<string>();
  const mine = summary.right;
  const theirs = challenge.score;
  const creator = playerName(challenge.creator);

  /**
   * Sends the result once at a time. A guest whose send failed is back at the name (with the line); a signed-in player has no name to give and gets a retry.
   */
  async function send(given?: string) {
    setPhase("sending");
    const failure = await accept.post(mine, summary.seconds ?? 0, accept.asksName ? given : undefined);
    setLine(failure);
    setPhase(failure === undefined ? "done" : accept.asksName ? "naming" : "failed");
  }

  // With an account the result goes at once; a guest is asked for a name first.
  useEffect(() => {
    if (accept.asksName) setPhase("naming");
    else void send();
  }, []);

  const outcome = outcomeOf(mine, theirs);
  /** Before the result is in: «تموم شد!»; after it: «بردی!» and both scores. */
  const decorated: RoundSummary = { ...summary, offer: undefined, won: phase === "done" && outcome === "won", ...(phase === "done" && { title: playCopy.title(outcome, creator), subtitle: playCopy.scores(mine, creator, theirs) }) };

  return (
    <RoundEnd
      summary={decorated}
      card={
        phase === "naming" || phase === "sending" ? (
          <form
            data-testid="challenge-name-card"
            className={card}
            onSubmit={(event) => {
              event.preventDefault();
              if (phase === "naming") void send(name);
            }}
          >
            <h2 className="text-[22px] leading-[1.3] text-ink">{playCopy.namePrompt}</h2>
            <p className="text-[12.5px] text-muted">{`تا ${creator} نتیجه‌ت رو ببینه.`}</p>
            <div {...feedbackPrivate}>
              <input
                data-testid="challenge-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
                maxLength={nameMaxLength}
                enterKeyHint="send"
                aria-label="اسمت"
                placeholder="اسمت"
                className="h-12 w-full rounded-full bg-paper px-4 text-[15px] text-ink placeholder:text-[#8A8698]"
              />
            </div>
            {line && (
              <p data-testid="challenge-error" className="text-xs text-fire">
                {line}
              </p>
            )}
            <BigButton compact type="submit" className="h-14 text-[21px]" disabled={phase === "sending"} data-testid="challenge-send-name">
              بفرست
            </BigButton>
          </form>
        ) : phase === "failed" ? (
          <div className={`${card} items-stretch text-center`}>
            <p data-testid="challenge-error" className="text-[13px] text-fire">
              {line}
            </p>
            <BigButton compact className="h-14 text-[21px]" onClick={() => void send()} data-testid="challenge-result-retry">
              دوباره
            </BigButton>
          </div>
        ) : undefined
      }
    />
  );
}
