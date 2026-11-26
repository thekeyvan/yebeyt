"use client";

import { motion, type PanInfo } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { sourceOf, type GameCouplet } from "../../lib/games/couplet";
import { statusOf, type AttemptWord } from "../../lib/games/jigsawBoard";
import { plain } from "../../lib/library/normalize";
import { useMediaQuery } from "../../lib/media";
import { menuArrival, settle, useVariant } from "../../lib/motion";
import { routeURL } from "../../lib/reader/route";
import { toast } from "../ui/Toast";
import { useMarkActions } from "../reader/useCoupletActions";
import { aiMeaning } from "../reader/MeaningCard";
import { MarkButton } from "../ui/MarkButton";
import { Reaction } from "../ui/Reaction";
import { WordSticker } from "../ui/WordSticker";
import { BookIcon, BookmarkIcon, CheckIcon, CloseIcon, MessagesIcon, SparkleIcon } from "../ui/icons";
import { BigButton } from "./chrome";

/** A drag down past this share of the sheet, or this fast (pixels per second), does what the big button does (`dragToDismiss`). */
const dismiss = { share: 0.3, velocity: 800 };

const action = "flex flex-1 flex-col items-center gap-1 rounded-2xl bg-board-paper py-2.5 text-[13px] font-medium text-ink";

function Verdict({ right, title, detail, celebrates }: { right: boolean; title: string; detail?: string; celebrates?: boolean }) {
  return (
    <div className="flex w-full items-center gap-2.5">
      <Reaction onAppear effect={right ? "wiggle" : "shake"} burst={right ? (celebrates ? "win" : "right") : undefined} big={celebrates} className="-rotate-[8deg]">
        <span data-testid="verdict-badge" className={`grid size-[46px] place-items-center rounded-full border-4 border-white shadow-[0_3px_4px_rgba(20,17,43,0.22)] ${right ? "bg-green text-ink" : "bg-fire text-white"}`}>
          {right ? <CheckIcon size={22} lineWidth={3} /> : <CloseIcon size={18} lineWidth={3} />}
        </span>
      </Reaction>
      <div className="min-w-0 flex-1">
        <p data-testid="verdict" className="font-title text-[26px] leading-[1.3] text-ink">
          {title}
        </p>
        {detail && <p className="text-[13px] text-muted">{detail}</p>}
      </div>
    </div>
  );
}

function Meaning({ couplet }: { couplet: GameCouplet }) {
  return (
    <div className="w-full rounded-[18px] bg-board-paper px-4 py-3.5">
      <div className="flex items-center gap-0.5">
        <span className="text-xs font-bold text-lapis">یعنی چی؟</span>
        {couplet.meaningIsAI && (
          <button type="button" aria-label={aiMeaning.label} onClick={() => toast(aiMeaning.toast)} className="-my-3 grid size-11 place-items-center text-lapis">
            <SparkleIcon size={16} />
          </button>
        )}
      </div>
      <p className="mt-1.5 text-[15px] leading-[1.8] text-ink">{couplet.meaning}</p>
      <p className="mt-1.5 text-[13px] text-muted">{sourceOf(couplet)}</p>
    </div>
  );
}

/** «کل شعر / نگه دار / بفرست»: the poem opens in the reader at the couplet; keeping and sending are the reader's. */
function Actions({ couplet }: { couplet: GameCouplet }) {
  const actions = useMarkActions({ path: couplet.poem, poet: couplet.poetName, title: couplet.bookTitle, line: { m1: couplet.m1, m2: couplet.m2 } }, couplet.index);
  return (
    <div className="flex w-full gap-2.5">
      <Link href={routeURL(couplet.poem, couplet.index, "couplet")} prefetch={false} className={action} data-testid="sheet-poem">
        <BookIcon size={22} lineWidth={2.2} />
        کل شعر
      </Link>
      <MarkButton action="keep" label="نگه دار" selected={actions.kept} onPress={actions.keep} className={action} caption="نگه دار">
        <BookmarkIcon size={22} lineWidth={2.2} fill={actions.kept ? "currentColor" : undefined} />
      </MarkButton>
      <MarkButton action="send" label="بفرست" onPress={actions.send} className={action} caption="بفرست">
        <MessagesIcon size={22} lineWidth={2.2} />
      </MarkButton>
    </div>
  );
}

type AnswerSheetProps = {
  couplet: GameCouplet;
  right: boolean;
  /** The title; «درست چسبوندی!» / «این یکی نشد» when not given. */
  title?: string;
  /** After a wrong couplet of جورچین: the words the player stuck, each marked right or wrong. */
  attempt?: AttemptWord[];
  /** After a wrong answer: the right words, written out. */
  correction?: string;
  /** «+۱۲۰ · ۱۸ ثانیه» */
  detail?: string;
  buttonTitle: string;
  next: () => void;
  /** A finished game or puzzle: the burst is bigger. */
  celebrates?: boolean;
};

/**
 * The sheet after every answer, right or wrong (Games/AnswerSheet.swift, JigsawResult): the verdict, the right answer when it was wrong, the couplet's meaning,
 * who said it and in which book, «کل شعر / نگه دار / بفرست» and a big button. It rises from the bottom over a dimmed page and follows a drag down, which does
 * what the big button does; a tap on the dimmed page does nothing (a stray tap would skip the verdict). From 768 px it is a dialog in the middle of the screen.
 */
export function AnswerSheet({ couplet, right, title, attempt = [], correction, detail, buttonTitle, next, celebrates }: AnswerSheetProps) {
  const v = useVariant();
  const wide = useMediaQuery("(min-width: 768px)");
  const panel = useRef<HTMLDivElement>(null);
  const heading = title ?? (right ? "درست چسبوندی!" : "این یکی نشد");

  // The sheet scrolls only when its content is more than fits: otherwise the burst of the verdict is free to leave its frame.
  const [tight, setTight] = useState(false);
  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    element.querySelector<HTMLElement>("[data-testid=next]")?.focus();
    setTight(element.scrollHeight > element.clientHeight + 1);
  }, []);

  const released = (_: unknown, { offset, velocity }: PanInfo) => {
    if (offset.y > dismiss.share * (panel.current?.offsetHeight ?? 400) || velocity.y >= dismiss.velocity) next();
  };

  const body: ReactNode = (
    <>
      <Verdict right={right} title={heading} detail={detail} celebrates={celebrates} />
      {!right && attempt.length > 0 && (
        <div className="flex w-full flex-wrap justify-center gap-1.5">
          {attempt.map((item, index) => (
            <span key={index} data-testid={`attempt-${item.mark}`} aria-label={`${item.word}، ${item.mark === "wrong" ? "نشد" : item.mark === "right" ? "درست" : ""}`}>
              <WordSticker word={item.word} status={statusOf(item.mark)} size={17} />
            </span>
          ))}
        </div>
      )}
      {!right && correction && (
        <p data-testid="correction" className="w-full rounded-[18px] border-[3px] border-green bg-[#EEF9E7] px-4 py-3 text-center font-poem text-xl leading-[1.7] text-ink">
          {plain(correction)}
        </p>
      )}
      {couplet.meaning && <Meaning couplet={couplet} />}
      <Actions couplet={couplet} />
      <BigButton onClick={next} data-testid="next">
        {buttonTitle}
      </BigButton>
    </>
  );

  return (
    <div className="fixed inset-0 z-20 flex" data-testid="answer-sheet">
      <motion.div aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-ink/[0.18]" />
      {wide ? (
        <motion.div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={heading}
          initial={{ ...menuArrival(v), opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={settle(v)}
          className={`relative m-auto flex max-h-[calc(100%-2rem)] w-[min(28rem,calc(100%-2rem))] flex-col items-center gap-4 rounded-[30px] bg-white px-5 py-6 shadow-[0_6px_12px_rgba(20,17,43,0.18)] ${tight ? "overflow-y-auto" : ""}`}
        >
          {body}
        </motion.div>
      ) : (
        <motion.div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={heading}
          initial={v === "full" ? { y: "100%" } : { opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={settle(v)}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.12, bottom: 1 }}
          onDragEnd={released}
          className={`relative mt-auto flex max-h-full w-full flex-col items-center gap-4 rounded-t-[30px] ${tight ? "overflow-y-auto" : ""} bg-white px-5 pt-3 pb-[max(30px,env(safe-area-inset-bottom))] shadow-[0_-6px_12px_rgba(20,17,43,0.18)]`}
        >
          <span aria-hidden className="h-[5px] w-10 shrink-0 rounded-pill bg-ring" />
          {body}
        </motion.div>
      )}
    </div>
  );
}
