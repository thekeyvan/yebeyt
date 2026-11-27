"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { isRightToLeft, settle, slideFrom, useVariant } from "../../lib/motion";
import { isGamePage } from "../../lib/games/kinds";
import { useStore } from "../../lib/library/browser";
import { trackNavigation } from "../../lib/nav";
import { tabAt } from "../../lib/tabs";
import { useServices } from "../account/useServices";
import { TabBar } from "../ui/TabBar";

/** A poem opened from inside the app is a cover over the page it came from (`reader`), and so is a game (`game`); the page stays under it. */
const covers = (pathname: string): boolean => pathname.startsWith("/poem/") || isGamePage(pathname);

/**
 * The tab bar and the page of the open tab. Switching tabs slides the new page in 40 from its tab's side (mirrored in
 * right-to-left) and never fades; the page that leaves is simply gone, as the router swaps it at once. While the reader or a game
 * covers the page, the page and the tab bar stay as they are, and nothing under the cover can be reached. The reader opens over a game too.
 */
export function Shell({ children, reader, game }: { children: ReactNode; reader: ReactNode; game: ReactNode }) {
  const pathname = usePathname();
  const covered = covers(pathname);
  const [under, setUnder] = useState(pathname);
  if (!covered && under !== pathname) setUnder(pathname);
  const current = tabAt(under);
  const v = useVariant();
  const friends = useServices()?.friends;
  const unread = useStore(friends)?.unreadMessages ?? 0;
  const requests = useStore(friends?.requests)?.incomingCount ?? 0;
  useEffect(trackNavigation, [pathname]);
  const previous = useRef<number | null>(null);
  useEffect(() => {
    if (!covered) previous.current = current;
  });
  const from = current === null ? 0 : slideFrom(previous.current, current, isRightToLeft(), v);
  return (
    <>
      <div inert={covered} className="overflow-x-clip">
        <motion.div key={current ?? under} initial={{ x: from }} animate={{ x: 0 }} transition={settle(v)}>
          {children}
        </motion.div>
      </div>
      <div inert={covered}>
        <TabBar current={current} unread={unread} requests={requests} hiddenOnPhone={under.startsWith("/messages/")} />
      </div>
      {game}
      {reader}
    </>
  );
}
