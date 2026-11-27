"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import type { AvatarParts } from "@yebeyt/avatar";
import { cn } from "../../lib/cn";
import { feedbackPrivate } from "../../lib/feedbackPrivate";
import { chatTime } from "../../lib/messages/copy";
import type { SharedDivanItem } from "../../lib/messages/models";
import { sourceOf } from "../../lib/messages/resolver";
import { bouncy, rowArrival, useVariant } from "../../lib/motion";
import { routeURL } from "../../lib/reader/route";
import { MarkButton } from "../ui/MarkButton";
import { HeartIcon } from "../ui/icons";
import { CoupletText } from "../reader/CoupletText";
import { useLongPress } from "../reader/useLongPress";
import { defaultSettings } from "../../lib/reader/settings";
import { ChatFace } from "./ChatFace";
import { useCouplet } from "./useCouplet";

/** «تو و سارا پسندیدید» (Messages/SharedDivanScreen.swift `likeText`). */
function likeText(item: SharedDivanItem, name: string): string {
  if (item.likedByMe && item.likedByThem) return `تو و ${name} پسندیدید`;
  if (item.likedByMe) return "تو پسندیدی";
  return item.likedByThem ? `${name} پسندید` : "۰";
}

/** One couplet of the shared divan: who added it and when, the note, the couplet (a tap opens the poem), its source and the like. A long press on one I added asks to take it out. */
function Card({ item, name, otherFace, myFace, like, askRemove }: { item: SharedDivanItem; name: string; otherFace: AvatarParts | null; myFace: AvatarParts; like: () => void; askRemove: () => void }) {
  const resolved = useCouplet(item.key);
  const hold = useLongPress(item.addedByMe ? askRemove : () => {});
  const any = item.likedByMe || item.likedByThem;
  return (
    <div data-testid={`shared-item-${item.id}`} className="flex flex-col gap-2 rounded-[22px] bg-white px-4 py-3 shadow-[0_2px_10px_rgba(20,17,43,0.07)]">
      <div className="flex items-center gap-2">
        <ChatFace parts={item.addedByMe ? myFace : otherFace} size={26} padding={2} />
        <span className="text-xs text-muted">
          <b className="text-ink">{item.addedByMe ? "تو" : name}</b> اضافه کرد · {chatTime.added(new Date(item.createdAt), new Date())}
        </span>
      </div>
      {item.note && (
        <p {...feedbackPrivate} className="me-10 w-fit rounded-[16px] rounded-ss-[4px] bg-[#FFF1F6] px-3 py-1.5 text-[13px] leading-[1.9] text-ink">
          {item.note}
        </p>
      )}
      {resolved ? (
        <Link {...hold} href={routeURL(resolved.path, resolved.index, "couplet")} data-testid={`shared-couplet-${item.id}`} aria-label={`${resolved.couplet.m1}، ${resolved.couplet.m2}`} className="block">
          <CoupletText couplet={resolved.couplet} settings={defaultSettings} size={17} factor={1.85} className="text-ink" />
        </Link>
      ) : (
        <p {...hold} data-testid={`shared-couplet-${item.id}`} className="py-5 text-center text-[17px] text-muted">
          …
        </p>
      )}
      <div className="flex items-center">
        <span className="flex-1 text-xs text-[#8A8698]">{resolved ? sourceOf(resolved) : ""}</span>
        <MarkButton action="like" label={item.likedByMe ? "پسندت رو بردار" : "پسند"} selected={item.likedByMe} onPress={() => (like(), !item.likedByMe)} className="flex items-center gap-1 py-1">
          <span data-testid={`like-${item.id}`} className={cn("flex items-center gap-1", any ? "text-magenta" : "text-ink")}>
            <HeartIcon size={18} lineWidth={2} fill={any ? "currentColor" : undefined} />
            <span className="text-xs text-muted">{likeText(item, name)}</span>
          </span>
        </MarkButton>
      </div>
    </div>
  );
}

/** The cards, which scale in and out as couplets come and go (`Motion.row`). */
export function SharedDivanCards({ items, ...rest }: { items: readonly SharedDivanItem[] } & Omit<Parameters<typeof Card>[0], "item" | "like" | "askRemove"> & { like: (item: SharedDivanItem) => void; askRemove: (item: SharedDivanItem) => void }) {
  const arrival = rowArrival(useVariant());
  const { like, askRemove, ...shared } = rest;
  return (
    <AnimatePresence initial={false}>
      {items.map((item) => (
        <motion.div key={item.id} layout="position" initial={arrival} animate={{ opacity: 1, scale: 1, y: 0 }} exit={arrival} transition={bouncy}>
          <Card item={item} {...shared} like={() => like(item)} askRemove={() => askRemove(item)} />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
