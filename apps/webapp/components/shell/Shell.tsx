"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { isRightToLeft, settle, slideFrom, useVariant } from "../../lib/motion";
import { trackNavigation } from "../../lib/nav";
import { tabAt } from "../../lib/tabs";
import { TabBar } from "../ui/TabBar";

/** A poem opened from inside the app is a cover over the page it came from (`reader`); the page stays under it. */
const covers = (pathname: string): boolean => pathname.startsWith("/poem/");

/**
 * The tab bar and the page of the open tab. Switching tabs slides the new page in 40 from its tab's side (mirrored in
 * right-to-left) and never fades; the page that leaves is simply gone, as the router swaps it at once. While the reader
 * covers the page, the page and the tab bar stay as they are, and nothing under the cover can be reached.
 */
export function Shell({ children, reader }: { children: ReactNode; reader: ReactNode }) {
  const pathname = usePathname();
  const covered = covers(pathname);
  const [under, setUnder] = useState(pathname);
  if (!covered && under !== pathname) setUnder(pathname);
  const current = tabAt(under);
  const v = useVariant();
  useEffect(trackNavigation, [pathname]);
  const previous = useRef<number | null>(null);
  useEffect(() => {
    if (!covered) previous.current = current;
  });
  const from = current === null ? 0 : slideFrom(previous.current, current, isRightToLeft(), v);
  return (
    <>
      <div inert={covered} className="overflow-x-clip">
        <motion.div key={under} initial={{ x: from }} animate={{ x: 0 }} transition={settle(v)}>
          {children}
        </motion.div>
      </div>
      <div inert={covered}>
        <TabBar current={current} />
      </div>
      {reader}
    </>
  );
}
