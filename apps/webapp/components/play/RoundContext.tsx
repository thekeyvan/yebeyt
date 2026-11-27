"use client";

import { createContext, useContext } from "react";
import type { GameCouplet } from "../../lib/games/couplet";
import type { ChallengeAccept } from "../../lib/play/challengeModels";
import type { Challenge } from "../../lib/play/models";

/** A challenge being answered: the model that posts the result, the challenge itself and its ten couplets (Play/ChallengeAcceptScreen.swift `ChallengeAnswer`). */
export type ChallengeAnswer = { accept: ChallengeAccept; challenge: Challenge; items: GameCouplet[] };

type Round = {
  /** The friends a challenge made from the round goes to (picked in the lobby). */
  invite: readonly string[];
  /** The round is a challenge's: exactly its ten couplets are played, and the result is posted at the end. */
  answering?: ChallengeAnswer;
};

/** What a جورچین or حدس شاعر round knows of the lobby or the challenge it was opened for; the end of the round reads it. */
export const RoundContext = createContext<Round>({ invite: [] });

export const useRound = (): Round => useContext(RoundContext);
