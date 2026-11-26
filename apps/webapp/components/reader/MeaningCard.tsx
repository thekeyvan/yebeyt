"use client";

import { motion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { bouncy, menuArrival, useVariant } from "../../lib/motion";
import { CloseIcon, SparkleIcon } from "../ui/icons";

/** What the sparkle says (Design/AISparkle.swift). */
export const aiMeaning = { label: "با کمک هوش مصنوعی", toast: "این معنی با کمک هوش مصنوعی نوشته شده" } as const;

/**
 * «معنی»: the couplet's meaning on a white card (Reader/MeaningCard.swift). Longer than three lines, it shows «بیشتر بخون» which opens
 * the rest in place. An AI-written meaning has a sparkle by the heading.
 */
export function MeaningCard({ text, ai, expanded, onExpand, onExplainAI, onClose }: { text: string; ai: boolean; expanded: boolean; onExpand: () => void; onExplainAI: () => void; onClose: () => void }) {
  const v = useVariant();
  const body = useRef<HTMLParagraphElement>(null);
  const [cut, setCut] = useState(false);

  // Cut when the three lines are not all of it; measured again when the card's width changes.
  useLayoutEffect(() => {
    const element = body.current;
    if (!element || expanded) return;
    const measure = () => setCut(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <motion.section
      aria-label="معنی"
      initial={{ ...menuArrival(v), opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={bouncy}
      className="w-full rounded-3xl bg-white px-[18px] pt-[18px] pb-4 text-ink shadow-[0_6px_11px_rgba(20,17,43,0.10)]"
    >
      <div className="flex items-center gap-0.5">
        <h2 className="text-xl leading-[1.5]">معنی</h2>
        {ai && (
          <button type="button" aria-label={aiMeaning.label} onClick={onExplainAI} className="-my-3 grid size-11 place-items-center text-lapis">
            <SparkleIcon size={16} />
          </button>
        )}
        <button type="button" aria-label="بستن معنی" onClick={onClose} className="-my-1.5 ms-auto grid size-11 place-items-center">
          <span className="grid size-8 place-items-center rounded-full bg-paper">
            <CloseIcon size={14} lineWidth={3} />
          </span>
        </button>
      </div>
      <p ref={body} className={`mt-3 whitespace-pre-line text-[15px] leading-[1.95] ${expanded ? "" : "line-clamp-3"}`}>
        {text}
      </p>
      {cut && !expanded && (
        <button type="button" onClick={onExpand} className="mt-3 text-[13px] font-bold text-lapis">
          بیشتر بخون
        </button>
      )}
    </motion.section>
  );
}
