"use client";

import { motion } from "motion/react";
import { Fragment, useEffect, useRef } from "react";
import { usePress } from "../../lib/motion";
import { nearestToTop } from "../../lib/reader/paging";
import { isPlaying } from "../../lib/reader/player";
import { listFactor, listSize, type TextSettings } from "../../lib/reader/settings";
import { MarkButton } from "../ui/MarkButton";
import { BookmarkIcon, MessagesIcon, PlayIcon } from "../ui/icons";
import { CoupletText } from "./CoupletText";
import { themeClasses } from "./theme";
import { useCoupletActions } from "./useCoupletActions";
import { useLongPress } from "./useLongPress";
import { usePlayerView } from "./usePlayerView";
import type { Reader } from "./useReader";

const round = "grid size-11 place-items-center rounded-full bg-paper text-ink";

function Row({ reader, index, settings, active, onRef }: { reader: Reader; index: number; settings: TextSettings; active: boolean; onRef: (element: HTMLElement | null) => void }) {
  const hold = useLongPress(() => reader.setHoldIndex(index));
  const couplet = reader.couplets[index]!;
  return (
    <div
      ref={onRef}
      role="button"
      aria-label={couplet.m2 ? `${couplet.m1}، ${couplet.m2}` : couplet.m1}
      tabIndex={0}
      data-testid={`couplet-${index}`}
      onClick={() => reader.openCouplet(index)}
      onKeyDown={(event) => event.key === "Enter" && reader.openCouplet(index)}
      {...hold}
      className={`-mx-2.5 cursor-pointer select-none rounded-[14px] px-2.5 [-webkit-touch-callout:none] ${active ? "bg-lapis/12" : ""}`}
    >
      <CoupletText couplet={couplet} settings={settings} size={listSize(settings)} factor={listFactor(settings)} className={themeClasses[settings.theme].text} />
    </div>
  );
}

/** Lapis then fire: the two small squares between couplets. */
const Separator = () => (
  <span aria-hidden className="flex gap-[3px] self-start">
    <span className="h-[9px] w-1.5 rounded-sm bg-lapis" />
    <span className="h-[9px] w-1.5 rounded-sm bg-fire" />
  </span>
);

/** The floating bar of the whole poem: بخون برام, نگه دار and بفرست. It acts on the couplet nearest the top of the screen. */
function Bar({ reader, raised }: { reader: Reader; raised: boolean }) {
  const actions = useCoupletActions(reader, reader.topIndex);
  const view = usePlayerView(reader.player);
  const press = usePress();
  const playing = view ? isPlaying(view) : false;
  return (
    <div className={`absolute inset-x-0 mx-auto flex w-fit gap-2 rounded-pill bg-white p-1.5 shadow-[0_4px_8px_rgba(20,17,43,0.16)] ${raised ? "bottom-[116px]" : "bottom-6"}`}>
      {view?.isAvailable && (
        <motion.button type="button" {...press} onClick={reader.togglePlayback} className="flex h-11 items-center gap-2 whitespace-nowrap rounded-pill bg-lapis ps-[18px] pe-4 text-sm font-bold text-white">
          {playing ? (
            <span className="flex gap-[3px]">
              <span className="h-3 w-[3.5px] rounded-sm bg-current" />
              <span className="h-3 w-[3.5px] rounded-sm bg-current" />
            </span>
          ) : (
            <PlayIcon size={14} />
          )}
          {playing ? "مکث" : "بخون برام"}
        </motion.button>
      )}
      <MarkButton action="keep" label="نگه دار" selected={actions.kept} onPress={actions.keep} className={round}>
        <BookmarkIcon size={20} lineWidth={2.2} fill={actions.kept ? "currentColor" : undefined} />
      </MarkButton>
      <MarkButton action="send" label="بفرست" onPress={actions.send} className={round}>
        <MessagesIcon size={20} lineWidth={2.2} />
      </MarkButton>
    </div>
  );
}

/**
 * The whole poem (Reader/WholePoemView.swift): every couplet with the two-square separators, and the floating bar. A tap on a couplet picks it
 * (couplet mode at it); a long press lifts it. The couplet nearest the top is the one the bar acts on; the recitation's couplet is lit and followed.
 */
export function WholePoem({ reader, settings }: { reader: Reader; settings: TextSettings }) {
  const list = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<number, HTMLElement>());
  const view = usePlayerView(reader.player);
  const active = view && view.state !== "idle" ? view.activeCouplet : undefined;

  // Opens with the couplet that was being shown at the top.
  useEffect(() => {
    const row = rows.current.get(reader.topIndex);
    if (row && list.current) list.current.scrollTop = row.offsetTop;
    // Only on opening: scrolling moves `topIndex` by itself.
  }, []);

  // Follows the recitation.
  useEffect(() => {
    if (active !== undefined) rows.current.get(active)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [active]);

  function scrolled() {
    const top = list.current?.getBoundingClientRect().top ?? 0;
    const measured = [...rows.current].map(([index, element]) => {
      const { top: minY, bottom: maxY } = element.getBoundingClientRect();
      return { index, minY: minY - top, maxY: maxY - top };
    });
    const nearest = nearestToTop(measured);
    if (nearest !== undefined) reader.setTopIndex(nearest);
  }

  return (
    <div className="relative h-full">
      <div ref={list} onScroll={scrolled} className="h-full overflow-y-auto px-[26px] pt-5 pb-[120px] [scrollbar-width:none] [mask-image:linear-gradient(to_bottom,transparent,black_22px,black_84%,transparent)] [&::-webkit-scrollbar]:hidden">
        <div className="relative flex flex-col gap-3.5">
          {reader.couplets.map((_, index) => (
            <Fragment key={index}>
              {index > 0 && <Separator />}
              <Row reader={reader} index={index} settings={settings} active={active === index} onRef={(element) => (element ? rows.current.set(index, element) : rows.current.delete(index))} />
            </Fragment>
          ))}
        </div>
      </div>
      <Bar reader={reader} raised={view !== undefined && view.state !== "idle"} />
    </div>
  );
}
