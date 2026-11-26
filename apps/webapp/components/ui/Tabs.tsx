"use client";

import { Tabs as SdkTabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { motion } from "motion/react";
import { useId, useState, type ReactNode } from "react";
import { isRightToLeft, settle, slideFrom, useVariant } from "../../lib/motion";

export type TabItem = { value: string; label: string; content: ReactNode };

/**
 * Tabs inside a page (Design/SegmentPaging.swift): the underline slides to the chosen tab and its page slides in 40
 * from that tab's side (mirrored in right-to-left) — it never fades. The behaviour (arrow keys, roles) is UI SDK's.
 */
export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  const [value, setValue] = useState(items[0]?.value ?? "");
  const [from, setFrom] = useState(0);
  const underline = useId();
  const v = useVariant();

  function choose(next: string) {
    const at = (name: string) => items.findIndex((item) => item.value === name);
    setFrom(slideFrom(at(value), at(next), isRightToLeft(), v));
    setValue(next);
  }

  return (
    <SdkTabs value={value} onValueChange={(next) => next && choose(next)}>
      <TabsList aria-label={label} className="flex gap-2 border-b border-ring">
        {items.map((item) => (
          <TabsTab
            key={item.value}
            value={item.value}
            className="relative px-4 pt-1 pb-2.5 text-[15px] font-bold text-muted data-selected:text-lapis"
          >
            {item.label}
            {item.value === value && (
              <motion.span layoutId={underline} transition={settle(v)} className="absolute inset-x-2 -bottom-px h-[3px] rounded-sm bg-lapis" />
            )}
          </TabsTab>
        ))}
      </TabsList>
      {items.map((item) => (
        <TabsPanel key={item.value} value={item.value} className="overflow-x-clip pt-4">
          <motion.div initial={{ x: from }} animate={{ x: 0 }} transition={settle(v)}>
            {item.content}
          </motion.div>
        </TabsPanel>
      ))}
    </SdkTabs>
  );
}
