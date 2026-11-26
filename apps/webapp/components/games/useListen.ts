"use client";

import { useEffect, useState } from "react";
import { ClipPlayer, type ClipView } from "../../lib/games/clipPlayer";
import type { QuizSession } from "../../lib/games/quizSession";
import { webAudioFade } from "../../lib/games/webAudioFade";
import { useStore } from "../../lib/library/browser";
import { toast } from "../ui/Toast";
import { useGame } from "./GameCover";

/**
 * The sound of گوش کن for the question in play: an `<audio>` made when the game opens and let go when it closes. The clip of a question waits for the
 * first press of play (a browser allows sound only after a gesture) and starts by itself from the next question on; the answer, a skip or the next
 * question stops it. `onFailure` is told when the recitation can't be played.
 */
export function useListen(session: QuizSession, onFailure: () => void): { view: ClipView; playOrPause: () => void; replay: () => void } {
  const { round } = session;
  const [player, setPlayer] = useState<ClipPlayer>();
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = "anonymous"; // Ganjoor allows it, and a Web Audio fade needs it
    const made = new ClipPlayer(audio, { fade: webAudioFade(audio), onFailure });
    setPlayer(made);
    return () => made.destroy();
    // `onFailure` only sets state, so the first render's is as good as any.
  }, []);

  const clip = round.sheetOpen ? undefined : round.current.clip;
  useEffect(() => player?.load(clip), [player, clip]);

  const view = useStore(player) ?? { state: "idle" as const, progress: 0 };
  /** «دوباره بشنو»: the first hemistich again from its start, once for each question. */
  const replay = () => session.useReplay() && player?.play();
  return {
    view,
    // A clip that has not played yet starts for free; one that has played is a replay.
    playOrPause: () => (view.state === "idle" ? player?.play() : view.state === "ended" ? replay() : player?.toggle()),
    replay,
  };
}

/** What the player is told when a recitation can't be played, and how long it shows before the game closes. */
const recitationFailed = { text: "خوانش باز نشد", seconds: 1.6 };

/** «خوانش باز نشد» and back to the tab (`recitationsFailed`). */
export function useRecitationFailed(failed: boolean): void {
  const { leave } = useGame();
  useEffect(() => {
    if (!failed) return;
    toast(recitationFailed.text);
    const timer = setTimeout(leave, recitationFailed.seconds * 1000);
    return () => clearTimeout(timer);
  }, [failed]);
}
