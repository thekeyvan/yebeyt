"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { isRightToLeft, settle, slideFrom, useVariant } from "../../lib/motion";
import { tabAt } from "../../lib/tabs";
import { TabBar } from "../ui/TabBar";

/**
 * The tab bar and the page of the open tab. Switching tabs slides the new page in 40 from its tab's side (mirrored in
 * right-to-left) and never fades; the page that leaves is simply gone, as the router swaps it at once.
 */
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = tabAt(pathname);
  const v = useVariant();
  const previous = useRef<number | null>(null);
  useEffect(() => {
    previous.current = current;
  });
  const from = current === null ? 0 : slideFrom(previous.current, current, isRightToLeft(), v);
  return (
    <>
      <div className="overflow-x-clip">
        <motion.div key={pathname} initial={{ x: from }} animate={{ x: 0 }} transition={settle(v)}>
          {children}
        </motion.div>
      </div>
      <TabBar current={current} />
    </>
  );
}
