"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { usePress } from "../../lib/motion";
import { isPlaying, type PlayerView } from "../../lib/reader/player";
import { MarkButton } from "../ui/MarkButton";
import { BookmarkIcon, HeartIcon, MessagesIcon, PlayIcon, RepostIcon } from "../ui/icons";
import type { CoupletActions } from "./useCoupletActions";

/** The play / pause button: lapis with two bars while playing, light lapis with a triangle when not (Reader/ReaderActionRow.swift `PlayToggle`). */
export function PlayToggle({ view, onToggle }: { view: PlayerView; onToggle: () => void }) {
  const press = usePress();
  const on = isPlaying(view);
  return (
    <motion.button type="button" {...press} aria-label={on ? "مکث" : "پخش خوانش"} onClick={onToggle} className="grid size-11 place-items-center">
      <span className={`grid size-[34px] place-items-center rounded-full ${on ? "bg-lapis text-white" : "bg-lapis-tint text-lapis"}`}>
        {on ? (
          <span className="flex gap-[3px]">
            <span className="h-3 w-[3.5px] rounded-sm bg-current" />
            <span className="h-3 w-[3.5px] rounded-sm bg-current" />
          </span>
        ) : (
          <PlayIcon size={14} />
        )}
      </span>
    </motion.button>
  );
}

/** پسند, بازنشر, بفرست and نگه دار on one couplet, each with its own pop-up. */
export function ActionRow({ actions, view, onToggle, text }: { actions: CoupletActions; view?: PlayerView; onToggle: () => void; text: string }) {
  const icon = (node: ReactNode) => <span className="grid h-11 w-[43px] place-items-center">{node}</span>;
  return (
    <div className="flex items-center justify-center">
      {view?.isAvailable && <PlayToggle view={view} onToggle={onToggle} />}
      <MarkButton action="like" label="پسند" selected={actions.liked} onPress={actions.like}>
        {icon(<span className="text-magenta"><HeartIcon size={21} lineWidth={2} fill={actions.liked ? "currentColor" : undefined} /></span>)}
      </MarkButton>
      <MarkButton action="repost" label="بازنشر" selected={actions.reposted} onPress={actions.repost}>
        {icon(<span className={actions.reposted ? "text-lapis" : text}><RepostIcon size={21} lineWidth={2.2} /></span>)}
      </MarkButton>
      <MarkButton action="send" label="بفرست" onPress={actions.send}>
        {icon(<span className={text}><MessagesIcon size={21} lineWidth={2.2} /></span>)}
      </MarkButton>
      <MarkButton action="keep" label="نگه دار" selected={actions.kept} onPress={actions.keep}>
        {icon(<span className={text}><BookmarkIcon size={21} lineWidth={2.2} fill={actions.kept ? "currentColor" : undefined} /></span>)}
      </MarkButton>
    </div>
  );
}
