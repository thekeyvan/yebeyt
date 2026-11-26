"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { Pick } from "../../lib/library/home";
import { usePress } from "../../lib/motion";
import { routeURL } from "../../lib/reader/route";
import { MarkButton } from "../ui/MarkButton";
import { BookmarkIcon, CloseIcon, HeartIcon, MessagesIcon, RepostIcon } from "../ui/icons";
import { useMarkActions } from "../reader/useCoupletActions";

/** One hemistich: Parastoo Bold 20 on a 42-unit line (line-height 2.1). */
const Line = ({ text }: { text: string }) => <span className="block min-h-[42px] text-center font-poem text-[20px] leading-[2.1] text-ink">{text}</span>;

const icon = "grid size-[30px] place-items-center";

/**
 * The card of «بیتِ امروز» as drawn on the Calm board: the couplet, the poet, پسند / بازنشر / بفرست, and «رد کن» next to «نگه دار»
 * (Home/DailyCard.swift). A tap on the couplet opens the reader at it.
 */
export function DailyCard({ pick, onReject }: { pick: Pick; onReject: () => void }) {
  const actions = useMarkActions({ path: pick.path, poet: pick.poet, title: pick.title, line: pick.couplet }, pick.index);
  const press = usePress();
  const { couplet } = pick;
  return (
    <div className="flex flex-col gap-3 rounded-[26px] bg-white px-[18px] pt-[22px] pb-3.5 shadow-[0_6px_11px_rgba(20,17,43,0.08)]">
      <Link href={routeURL(pick.path, pick.index, "couplet")} data-testid="daily-couplet" className="flex flex-col gap-3" aria-label={`${couplet.m1} ${couplet.m2} ${pick.poet}`}>
        <span aria-hidden>
          <Line text={couplet.m1} />
          {couplet.m2 && <Line text={couplet.m2} />}
        </span>
        <span aria-hidden className="text-center text-[13px] text-muted">
          {pick.poet}
        </span>
      </Link>
      <div className="flex items-center justify-center gap-[18px]">
        <MarkButton action="like" label="پسند" selected={actions.liked} onPress={actions.like} className={icon}>
          <span className={actions.liked ? "text-magenta" : "text-ink"}>
            <HeartIcon size={22} lineWidth={2.2} fill={actions.liked ? "currentColor" : undefined} />
          </span>
        </MarkButton>
        <MarkButton action="repost" label="بازنشر" selected={actions.reposted} onPress={actions.repost} className={icon}>
          <span className={actions.reposted ? "text-lapis" : "text-ink"}>
            <RepostIcon size={22} lineWidth={2.2} />
          </span>
        </MarkButton>
        <MarkButton action="send" label="بفرست" onPress={actions.send} className={icon}>
          <span className="text-ink">
            <MessagesIcon size={22} lineWidth={2.2} />
          </span>
        </MarkButton>
      </div>
      <div className="flex gap-2.5">
        <motion.button type="button" {...press} onClick={onReject} data-testid="reject" className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-paper text-[15px] font-bold text-ink">
          <CloseIcon size={18} lineWidth={2.6} />
          رد کن
        </motion.button>
        <MarkButton
          action="keep"
          label="نگه دار"
          selected={actions.kept}
          onPress={actions.keep}
          className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl border-[3px] border-white bg-lapis text-[15px] font-bold text-white shadow-[0_2px_8px_rgba(20,17,43,0.22)]"
          caption="نگه دار"
        >
          <BookmarkIcon size={18} lineWidth={2.4} fill={actions.kept ? "currentColor" : undefined} />
        </MarkButton>
      </div>
    </div>
  );
}
