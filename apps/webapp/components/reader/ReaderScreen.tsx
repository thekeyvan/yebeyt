"use client";

import { motion, useDragControls } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { progressStore } from "../../lib/library/browser";
import { coverAway, coverDrop, coverRise, useVariant } from "../../lib/motion";
import { useTextSettings } from "../../lib/reader/browser";
import { keyStep } from "../../lib/reader/paging";
import { routeURL, type ReaderRoute } from "../../lib/reader/route";
import { Button } from "../ui/Button";
import { CoupletMode } from "./CoupletMode";
import { HoldMenu } from "./HoldMenu";
import { PlayerBar } from "./PlayerBar";
import { ProgressRail } from "./ProgressRail";
import { ReaderHeader } from "./ReaderHeader";
import { TextSheet } from "./TextSheet";
import { themeClasses } from "./theme";
import { useMediaSession, usePlayerView } from "./usePlayerView";
import { useReader } from "./useReader";
import { WholePoem } from "./WholePoem";

/** How far down the header has to be pulled, in pixels, or how fast in pixels per second, to close the reader. */
const pullToClose = { distance: 120, velocity: 600 };

/**
 * The full-screen reader over the tabs (Reader/ReaderView.swift): the shared header and mode toggle, then the couplet page or the whole poem,
 * with the «آ» sheet and the lifted-couplet menu on top. Closed with the round chevron button, Escape or a pull down on the header. Opened inside
 * the app (`modal`) it rises from the bottom like a sheet and closes back to where it came from; opened by a link it is just there, and closes to the home.
 */
export function ReaderScreen({ route, modal }: { route: ReaderRoute; modal: boolean }) {
  const router = useRouter();
  const v = useVariant();
  const [initial] = useState(route);
  const reader = useReader(initial);
  const [settings, update] = useTextSettings();
  const view = usePlayerView(reader.player);
  const controls = useDragControls();
  const [leaving, setLeaving] = useState(false);
  const theme = themeClasses[settings.theme];
  const loaded = reader.phase === "loaded";
  const { content } = reader;

  const close = () => (modal ? setLeaving(true) : router.push("/"));

  // The address keeps the couplet and the mode, so a link reopens the same couplet.
  useEffect(() => {
    if (loaded) window.history.replaceState(window.history.state, "", routeURL(initial.path, reader.actionIndex, reader.mode));
  }, [loaded, initial.path, reader.actionIndex, reader.mode]);

  // Where the reader is, for «ادامه بده» and «خوندی»: the couplet on the page, or the one at the top of the list.
  useEffect(() => {
    if (loaded && content) progressStore().opened(content.poem.path, reader.actionIndex, content.poem.couplets.length, content.title);
  }, [loaded, content, reader.actionIndex]);
  useEffect(() => {
    if (reader.reachedEnd && content) progressStore().reachedEnd(content.poem.path, content.poem.couplets.length);
  }, [reader.reachedEnd, content]);

  // The page follows the recitation (the whole-poem list scrolls to it by itself).
  const active = view?.activeCouplet;
  useEffect(() => {
    if (active !== undefined && reader.mode === "couplet") reader.follow(active);
    // `follow` is new on every render; what matters is that the recitation moved.
  }, [active]);

  useMediaSession(reader.player, view, content?.title ?? "", content?.poet ?? "");

  // Escape closes the reader and the arrow keys turn the couplet, unless a sheet, a menu or the gate is open or a control wants the key (the sliders).
  // Capture phase, so the dialog that handles this Escape itself is still there to be seen.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      if (event.key === "Escape") return close();
      const target = event.target as HTMLElement;
      const step = keyStep(event.key);
      if (!loaded || reader.mode !== "couplet" || step === 0 || target.closest('input, [role="slider"], [role="radiogroup"], [role="tablist"]')) return;
      event.preventDefault();
      reader.step(step);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  return (
    <motion.div
      initial={modal ? coverAway(v) : false}
      animate={leaving ? coverAway(v) : { y: "0%", opacity: 1 }}
      transition={leaving ? coverDrop(v) : coverRise(v)}
      onAnimationComplete={() => leaving && router.back()}
      className={`fixed inset-0 z-[35] ${theme.page} ${theme.text}`}
      data-testid="reader"
    >
      <motion.div
        drag="y"
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, { offset, velocity }) => (offset.y > pullToClose.distance || velocity.y > pullToClose.velocity) && close()}
        className="relative mx-auto flex h-full w-full max-w-[640px] flex-col"
      >
        <ReaderHeader content={content} mode={reader.mode} onMode={reader.setMode} onClose={close} onText={() => reader.setTextSheetOpen(true)} onGrab={(event) => controls.start(event)} secondary={theme.secondary} />
        <div className="relative min-h-0 flex-1">
          {reader.phase === "loading" && <div aria-busy className="h-full" />}
          {reader.phase === "failed" && (
            <div role="alert" className="flex h-full flex-col items-center justify-center gap-4">
              <p className="font-title text-2xl">شعر باز نشد</p>
              <Button variant="ghost" onClick={reader.retry}>
                دوباره
              </Button>
            </div>
          )}
          {loaded && reader.mode === "couplet" && <CoupletMode reader={reader} settings={settings} />}
          {loaded && reader.mode === "scroll" && <WholePoem reader={reader} settings={settings} />}
          {loaded && reader.mode === "couplet" && <ProgressRail index={reader.index} count={reader.couplets.length} secondary={theme.secondary} track={theme.track} />}
        </div>
        {reader.player && view && view.state !== "idle" && <PlayerBar player={reader.player} view={view} couplet={reader.actionIndex} />}
      </motion.div>
      <TextSheet open={reader.textSheetOpen} onClose={() => reader.setTextSheetOpen(false)} settings={settings} update={update} />
      {loaded && reader.holdIndex !== undefined && <HoldMenu reader={reader} index={reader.holdIndex} settings={settings} />}
    </motion.div>
  );
}
