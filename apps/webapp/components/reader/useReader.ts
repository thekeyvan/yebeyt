"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "../ui/Toast";
import { poetryStore } from "../../lib/poetry/browser";
import type { Poem } from "../../lib/poetry/models";
import { clamp } from "../../lib/reader/paging";
import { audioEngine } from "../../lib/reader/audio";
import { RecitationPlayer } from "../../lib/reader/player";
import type { ReaderMode, ReaderRoute } from "../../lib/reader/route";
import { shortTitle, subtitle } from "../../lib/reader/text";

export type ReaderContent = { poem: Poem; poet: string; title: string; subtitle: string };

/**
 * The state of one open poem in the reader (Reader/ReaderModel.swift): loading, the mode, the current couplet, the meaning card, the
 * hold menu and the recitation. The views only draw it and call its methods.
 */
export function useReader(initial: ReaderRoute) {
  const [phase, setPhase] = useState<"loading" | "failed" | "loaded">("loading");
  const [attempt, setAttempt] = useState(0);
  const [content, setContent] = useState<ReaderContent>();
  const [player, setPlayer] = useState<RecitationPlayer>();
  const [mode, setMode] = useState<ReaderMode>(initial.mode);
  const [index, setIndexState] = useState(initial.couplet);
  // The couplet as of the last change, which a second key pressed before the page is drawn again must start from.
  const shown = useRef(index);
  const setIndex = (next: number) => {
    shown.current = next;
    setIndexState(next);
  };
  /** The couplet at the top of the whole-poem list, which بفرست and نگه دار act on in that mode. */
  const [topIndex, setTopIndex] = useState(initial.couplet);
  const [meaning, setMeaning] = useState({ open: false, expanded: false });
  const [holdIndex, setHoldIndex] = useState<number>();
  const [textSheetOpen, setTextSheetOpen] = useState(false);

  useEffect(() => {
    let current = true;
    let made: RecitationPlayer | undefined;
    setPhase("loading");
    (async () => {
      try {
        const store = await poetryStore();
        const poem = await store.poem(initial.path);
        const poet = store.poetOf(initial.path);
        const bookPath = initial.path.split("/").slice(0, -1).join("/");
        const book = poet?.books.find(({ path }) => path === bookPath)?.title ?? (await store.book(bookPath).then(({ title }) => title, () => undefined));
        if (!current) return;
        const start = clamp(initial.couplet, poem.couplets.length);
        made = new RecitationPlayer({
          couplets: poem.couplets,
          fetchRecitations: () => store.recitations(poem.id),
          fetchTiming: async (url) => {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`timing ${response.status}`);
            return response.text();
          },
          makeEngine: audioEngine,
          onFailure: () => toast("خوانش باز نشد"),
        });
        setContent({ poem, poet: poet?.nickname ?? "", title: shortTitle(poem.title), subtitle: subtitle(poet?.nickname ?? "", book) });
        setIndex(start);
        setTopIndex(start);
        setMeaning({ open: initial.meaning && poem.couplets[start]?.meaning !== undefined, expanded: false });
        setPlayer(made);
        setPhase("loaded");
        void made.prefetch();
      } catch {
        if (current) setPhase("failed");
      }
    })();
    return () => {
      current = false;
      made?.stop();
    };
  }, [initial, attempt]);

  const couplets = content?.poem.couplets ?? [];
  const hasMeaning = (couplet: number) => couplets[couplet]?.meaning !== undefined;
  /** The couplet the actions act on: the one on the page, or the one at the top of the list. */
  const actionIndex = mode === "couplet" ? index : topIndex;
  const closeMeaning = () => setMeaning({ open: false, expanded: false });
  /** The user moved to a couplet (a swipe, a key): the meaning card closes, as it belongs to the couplet it was opened on, and a recitation that plays goes to where that couplet starts. */
  const go = (target: number) => {
    const next = clamp(target, couplets.length);
    if (next === shown.current) return;
    setIndex(next);
    closeMeaning();
    player?.seekToCouplet(next);
  };

  return {
    phase,
    content,
    couplets,
    player,
    mode,
    index,
    topIndex,
    actionIndex,
    meaning,
    holdIndex,
    textSheetOpen,
    hasMeaning,
    retry: () => setAttempt((n) => n + 1),
    setTopIndex,
    setHoldIndex,
    setTextSheetOpen,
    closeMeaning,
    openMeaning: () => setMeaning({ open: hasMeaning(shown.current), expanded: false }),
    expandMeaning: () => setMeaning({ open: true, expanded: true }),
    /** The mode toggle: each mode starts where the other one was. */
    setMode(next: ReaderMode) {
      if (next === mode) return;
      if (next === "scroll") setTopIndex(shown.current);
      else setIndex(clamp(topIndex, couplets.length));
      closeMeaning();
      setMode(next);
    },
    go,
    /** The next couplet (1) or the one before (−1), from the one that is shown now. */
    step: (by: -1 | 1) => go(shown.current + by),
    /** The recitation reached a couplet and the page follows it. Unlike `go` it never seeks: the audio is already there, and seeking would loop. */
    follow(couplet: number) {
      const next = clamp(couplet, couplets.length);
      if (next === shown.current) return;
      setIndex(next);
      closeMeaning();
    },
    /** Couplet mode at a couplet, from the whole-poem list or the lifted couplet's menu. */
    openCouplet(target: number, withMeaning = false) {
      const next = clamp(target, couplets.length);
      setMode("couplet");
      setHoldIndex(undefined);
      setIndex(next);
      setMeaning({ open: withMeaning && hasMeaning(next), expanded: false });
      player?.seekToCouplet(next);
    },
    /** The play button: starts the recitation at the couplet being shown (the page, or the top of the list), or pauses and resumes it. */
    togglePlayback: () => player?.toggle(actionIndex),
  };
}

export type Reader = ReturnType<typeof useReader>;
