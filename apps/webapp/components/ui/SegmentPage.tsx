"use client";

import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { isRightToLeft, settle, slideFrom, useVariant } from "../../lib/motion";

/**
 * The page of a segmented control or tab strip (Design/SegmentPaging.swift): when `value` changes, the new page slides in 40 from the side of
 * its segment (mirrored in right-to-left) with the bouncy spring, and never fades. `order` is the segments, first to last.
 */
export function SegmentPage({ value, order, children }: { value: string; order: readonly string[]; children: ReactNode }) {
  const v = useVariant();
  const [shown, setShown] = useState({ value, from: 0 });
  if (shown.value !== value) setShown({ value, from: slideFrom(order.indexOf(shown.value), order.indexOf(value), isRightToLeft(), v) });
  return (
    <div className="overflow-x-clip">
      <motion.div key={shown.value} data-testid="segment-page" initial={{ x: shown.from }} animate={{ x: 0 }} transition={settle(v)}>
        {children}
      </motion.div>
    </div>
  );
}
