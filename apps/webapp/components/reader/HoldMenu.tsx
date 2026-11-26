"use client";

import { Dialog, DialogBackdrop, DialogContent, DialogTitle } from "@ui-sdk/react/dialog";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useAccount } from "../account/AccountProvider";
import { bouncy, menuArrival, useVariant } from "../../lib/motion";
import { listFactor, listSize, type TextSettings } from "../../lib/reader/settings";
import { caption } from "../../lib/reader/text";
import { MarkButton } from "../ui/MarkButton";
import { BookIcon, BookmarkIcon, CopyIcon, CoupletFocusIcon, GamesIcon, HeartIcon, MessagesIcon, RepostIcon, SharedDivanIcon } from "../ui/icons";
import { CoupletText } from "./CoupletText";
import { useCoupletActions } from "./useCoupletActions";
import type { Reader } from "./useReader";

const round = "grid size-[52px] place-items-center rounded-full bg-paper";
const raised = "bg-white shadow-[0_8px_10px_rgba(20,17,43,0.18)]";

function Item({ icon, onPress, children }: { icon: ReactNode; onPress: () => void; children: string }) {
  return (
    <li className="border-t border-paper first:border-t-0">
      <button type="button" onClick={onPress} className="flex w-full items-center gap-3 px-1 py-3 text-start text-[15px] font-medium text-ink">
        <span className="text-lapis">{icon}</span>
        {children}
      </button>
    </li>
  );
}

/**
 * A long press on a couplet (Reader/HoldMenu.swift): the page blurs, the couplet is lifted on a tilted card, with a row of icons and a list.
 * A dialog (UI SDK's, so focus stays inside, Escape closes and focus goes back to the couplet) whose scrim is the page behind it, blurred.
 */
export function HoldMenu({ reader, index, settings, onPlay }: { reader: Reader; index: number; settings: TextSettings; onPlay: (index: number) => void }) {
  const account = useAccount();
  const v = useVariant();
  const actions = useCoupletActions(reader, index);
  const couplet = reader.couplets[index]!;
  const close = () => reader.setHoldIndex(undefined);
  const outside = (event: { target: unknown; currentTarget: unknown }) => event.target === event.currentTarget && close();
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogBackdrop className="fixed inset-0 z-40 bg-ink/38 backdrop-blur-[3px]" />
      <DialogContent className="fixed inset-0 z-50 overflow-y-auto outline-none" onClick={outside}>
        <DialogTitle className="sr-only">کارهای این بیت</DialogTitle>
        <motion.div
          initial={{ ...menuArrival(v), opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={bouncy}
          style={{ transformOrigin: "50% 35%" }}
          className="mx-auto flex min-h-full max-w-[560px] flex-col gap-3 px-4 pt-[max(calc(env(safe-area-inset-top)+8px),min(30dvh,258px))] pb-6"
          onClick={outside}
        >
          <div className="scale-[1.03] -rotate-[1.5deg] rounded-3xl bg-white px-5 py-[18px] shadow-[0_18px_18px_rgba(20,17,43,0.32)]">
            <CoupletText couplet={couplet} settings={settings} size={listSize(settings)} factor={listFactor(settings)} className="text-ink" />
            <p className="mt-1 text-end text-xs text-muted">{caption(reader.content?.poet ?? "", reader.content?.title ?? "", index)}</p>
          </div>
          <div className={`flex justify-between rounded-[26px] px-4 py-2.5 ${raised}`}>
            <MarkButton action="like" label="پسند" selected={actions.liked} onPress={actions.like} className={round}>
              <span className="text-magenta">
                <HeartIcon size={22} lineWidth={2.2} fill={actions.liked ? "currentColor" : undefined} />
              </span>
            </MarkButton>
            <MarkButton action="repost" label="بازنشر" selected={actions.reposted} onPress={actions.repost} className={round}>
              <span className={actions.reposted ? "text-lapis" : "text-ink"}>
                <RepostIcon size={22} lineWidth={2.2} />
              </span>
            </MarkButton>
            <MarkButton
              action="send"
              label="بفرست"
              onPress={() => {
                close();
                return actions.send();
              }}
              className={round}
            >
              <MessagesIcon size={22} lineWidth={2.2} />
            </MarkButton>
            <MarkButton action="keep" label="نگه دار" selected={actions.kept} onPress={actions.keep} className={round}>
              <BookmarkIcon size={22} lineWidth={2.2} fill={actions.kept ? "currentColor" : undefined} />
            </MarkButton>
          </div>
          <ul className={`rounded-3xl px-4 py-1 ${raised}`}>
            {couplet.meaning !== undefined && (
              <Item icon={<BookIcon size={20} lineWidth={2.2} />} onPress={() => reader.openCouplet(index, true)}>
                معنی این بیت
              </Item>
            )}
            <Item icon={<CoupletFocusIcon size={20} lineWidth={2.2} />} onPress={() => reader.openCouplet(index)}>
              بیت به بیت، از همین بیت
            </Item>
            <Item icon={<GamesIcon size={20} lineWidth={2.2} />} onPress={() => {
                close();
                onPlay(index);
              }}>
              بازی با این بیت
            </Item>
            <Item
              icon={<SharedDivanIcon size={20} lineWidth={2.2} />}
              onPress={() => {
                close();
                account.require("messages");
              }}
            >
              به دیوان مشترک
            </Item>
            <Item
              icon={<CopyIcon size={20} lineWidth={2.2} />}
              onPress={() => {
                actions.copy();
                close();
              }}
            >
              کپی متن
            </Item>
          </ul>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
