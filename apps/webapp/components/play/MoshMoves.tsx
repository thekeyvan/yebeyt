"use client";

import { useEffect, useRef } from "react";
import { plain } from "../../lib/library/normalize";
import { parseCoupletKey } from "../../lib/messages/copy";
import { lastLetterRange } from "../../lib/play/moshLetters";
import type { MoshState } from "../../lib/play/moshState";
import { cn } from "../../lib/cn";
import { usePoetName } from "../messages/useCouplet";

/** The couplet's second hemistich with its last letter marked: amber on the other's white bubble, lapis on the card in the chat. */
export function LastLetter({ text, mark = "bg-amber text-ink" }: { text: string; mark?: string }) {
  const range = lastLetterRange(text);
  if (!range) return <>{text}</>;
  return (
    <>
      {text.slice(0, range.start)}
      <mark data-testid="last-letter" className={cn("rounded-[5px] px-[3px] text-inherit", mark)}>
        {text.slice(range.start, range.end)}
      </mark>
      {text.slice(range.end)}
    </>
  );
}

/**
 * The couplets played, mine at the end (physical left) in lapis and the other's at the start in white, each with its poet; the last one has its last letter marked
 * (Play/MoshScreen.swift `MoshMoves`).
 */
export function MoshMoves({ state }: { state: MoshState }) {
  const poetName = usePoetName();
  const scroller = useRef<HTMLDivElement>(null);
  const count = state.game.moves.length;
  // The list stays at its end (the phone's `defaultScrollAnchor(.bottom)`): when a couplet comes, and when the room it has changes (the panel under it grows or shrinks).
  useEffect(() => {
    const element = scroller.current;
    const list = element?.firstElementChild;
    if (!element || !list) return;
    const stick = () => {
      element.scrollTop = element.scrollHeight;
    };
    stick();
    const watch = new ResizeObserver(stick);
    watch.observe(element);
    watch.observe(list);
    return () => watch.disconnect();
  }, [count]);
  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-[18px]">
      <ol data-testid="mosh-moves" className="flex flex-col gap-2.5 pt-2">
        {state.game.moves.map((move) => {
          const mine = move.username === state.me;
          const slug = parseCoupletKey(move.key)?.path.split("/")[1] ?? "";
          const poet = slug ? poetName(slug) : "";
          const who = mine ? "تو" : state.otherName;
          return (
            <li key={move.n} data-testid={`mosh-move-${move.n}`} className={cn("flex max-w-[297px] flex-col gap-1", mine ? "self-end" : "self-start")}>
              <span className={cn("text-[11px] text-muted", mine ? "text-end" : "text-start")}>{poet ? `${who} · ${poet}` : who}</span>
              <span
                className={cn(
                  "flex flex-col gap-0.5 rounded-[22px] px-3.5 py-2.5 font-poem text-[15.5px] leading-[1.9] shadow-[0_2px_4px_rgba(20,17,43,0.1)]",
                  mine ? "rounded-ss-[6px] bg-lapis text-white" : "rounded-se-[6px] bg-white text-ink",
                )}
              >
                <span>{plain(move.m1)}</span>
                <span>{move.n === state.lastMove?.n ? <LastLetter text={plain(move.m2)} /> : plain(move.m2)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
