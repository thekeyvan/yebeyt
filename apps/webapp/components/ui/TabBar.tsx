"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { pop, useVariant, usePress } from "../../lib/motion";
import { persianDigits, unreadText } from "../../lib/persian";
import { tabs } from "../../lib/tabs";
import { FaceCircle } from "../me/FaceCircle";
import { useAvatarParts } from "../me/useAvatarParts";
import { ExploreIcon, GamesIcon, HomeIcon, MessagesIcon } from "./icons";

const PressLink = motion.create(Link);

/** The tab's icon pops when its tab opens (`popWhen(on)`); it does not on the first draw. */
function Pop({ on, children }: { on: boolean; children: ReactNode }) {
  const { scale, times, duration } = pop(useVariant());
  return (
    <motion.span initial={false} animate={{ scale: on ? scale : 1 }} transition={{ duration, times }} className="flex">
      {children}
    </motion.span>
  );
}

const tint = "color-mix(in srgb, var(--color-lapis) 18%, transparent)";

function UnreadBadge({ text }: { text: string }) {
  return (
    <span
      aria-hidden
      className="absolute -end-[9px] -top-[6px] flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] border-2 border-white bg-fire px-1 text-[10px] font-bold text-white"
    >
      {text}
    </span>
  );
}

/** The raised round «بازی» button: its top sits 18 above the bar (the board's margin-top of -30 on a 56 circle). */
function GamesButton({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "-mt-[30px] flex h-14 w-14 items-center justify-center rounded-full lg:mt-0",
        on ? "border-4 border-white bg-lapis text-white shadow-[0_3px_10px_rgba(20,17,43,0.25)]" : "border-3 border-game-ring bg-white text-lapis shadow-[0_2px_6px_rgba(20,17,43,0.12)]",
      )}
    >
      <Pop on={on}>
        <GamesIcon size={26} lineWidth={2.2} />
      </Pop>
    </span>
  );
}

/** «من»: the person's own face in a ring, lapis when the tab is open (`meAvatar` in Features/TabBar.swift: 30 wide, the face 2 in from a white border). */
function MeRing({ on }: { on: boolean }) {
  const parts = useAvatarParts();
  return (
    <span className={cn("flex size-[30px] rounded-full border-2 border-white", on ? "shadow-[0_0_0_2.5px_var(--color-lapis)]" : "shadow-[0_0_0_1.5px_var(--color-ring)]")}>
      <Pop on={on}>
        <FaceCircle parts={parts} size={26} padding={2} />
      </Pop>
    </span>
  );
}

function icon(index: number, on: boolean, unread: string | null): ReactNode {
  const lineWidth = on ? 2.4 : 2;
  switch (index) {
    case 0:
      return <HomeIcon lineWidth={lineWidth} fill={on ? "currentColor" : undefined} />;
    case 1:
      return <ExploreIcon lineWidth={lineWidth} fill={on ? tint : undefined} />;
    case 2:
      return <GamesButton on={on} />;
    case 3:
      return (
        <span className="relative flex">
          <MessagesIcon lineWidth={lineWidth} fill={on ? "currentColor" : undefined} />
          {unread && <UnreadBadge text={unread} />}
        </span>
      );
    default:
      return <MeRing on={on} />;
  }
}

/**
 * The tab bar (Features/TabBar.swift; the exact spec is `nav()` in design/canvas/gen_explore.py): a white bar 64 high
 * (70 with its top gap) with 14 at the sides and 18 below; lapis on the open tab with a 16×3 line under it; the raised
 * round «بازی» in the middle. From 1024 px it is a rail on the right (the start side), in a column.
 * `current` is the open tab's index (null on a page outside the tabs); the badge on «پیام‌ها» counts the `unread` messages and the friend `requests`
 * waiting for an answer, and says each to screen readers (`unreadAccessibilityLabel` in App/AppModel.swift). `hiddenOnPhone` is for a chat, a shared divan and the requests, which are drawn
 * without it (`showsTabBar` in App/AppModel.swift); the rail stays from 1024 px.
 */
export function TabBar({ current, unread = 0, requests = 0, hiddenOnPhone = false }: { current: number | null; unread?: number; requests?: number; hiddenOnPhone?: boolean }) {
  const press = usePress();
  const unreadLabel = unreadText(unread + requests);
  const spoken = [unread > 0 && `${persianDigits(unread)} پیام نخونده`, requests > 0 && `${persianDigits(requests)} درخواست دوستی`].filter(Boolean).join("، ");
  return (
    <nav
      aria-label="تب‌ها"
      className={cn("fixed start-[max(14px,env(safe-area-inset-right))] end-[max(14px,env(safe-area-inset-left))] bottom-[calc(18px+env(safe-area-inset-bottom))] z-30 grid h-[70px] grid-cols-5 items-center rounded-tab-bar bg-white pt-1.5 shadow-tab-bar lg:start-4 lg:end-auto lg:top-1/2 lg:bottom-auto lg:flex lg:h-auto lg:w-24 lg:-translate-y-1/2 lg:flex-col lg:gap-6 lg:py-6", hiddenOnPhone && "max-lg:hidden")}
    >
      {tabs.map((tab, index) => {
        const on = current === index;
        const waiting = tab.href === "/messages" ? unreadLabel : null;
        return (
          <PressLink
            key={tab.href}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            aria-label={waiting ? `${tab.title} ${spoken}` : undefined}
            {...press}
            className={cn("flex flex-col items-center gap-[3px]", on ? "text-lapis" : "text-muted")}
          >
            {icon(index, on, waiting)}
            <span className={cn("text-[11px] leading-[1.6]", on ? "font-bold" : "font-medium")}>{tab.title}</span>
            <span aria-hidden className={cn("h-[3px] w-4 rounded-xs", on && "bg-lapis")} />
          </PressLink>
        );
      })}
    </nav>
  );
}
