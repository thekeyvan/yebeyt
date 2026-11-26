"use client";

import { ChevronDownIcon } from "../ui/icons";
import { CoupletPage } from "./CoupletPage";
import { CoupletPager } from "./CoupletPager";
import type { Reader } from "./useReader";
import type { TextSettings } from "../../lib/reader/settings";

const arrow = "grid size-11 place-items-center rounded-full bg-white text-ink shadow-card disabled:opacity-40";

/**
 * One couplet at a time (Reader/CoupletModeView.swift). Pages scroll vertically and snap. Beside them, for pointer users, two buttons for the
 * couplet before and after; the arrow keys do the same (see the reader).
 */
export function CoupletMode({ reader, settings }: { reader: Reader; settings: TextSettings }) {
  const count = reader.couplets.length;
  const locked = reader.meaning.open || reader.holdIndex !== undefined || reader.textSheetOpen;
  return (
    <div className="relative h-full">
      <CoupletPager count={count} index={reader.index} onPage={reader.go} locked={locked}>
        {/* Only the page and its neighbours are drawn; the others keep their height, so the scroll does not jump. */}
        {(page) => (Math.abs(page - reader.index) <= 1 ? <CoupletPage reader={reader} index={page} settings={settings} /> : null)}
      </CoupletPager>
      <div className="absolute start-3 top-1/2 hidden -translate-y-1/2 flex-col gap-2 pointer-fine:flex">
        <button type="button" aria-label="بیت قبلی" disabled={reader.index === 0} onClick={() => reader.step(-1)} className={arrow}>
          <span className="rotate-180">
            <ChevronDownIcon size={22} lineWidth={2.6} />
          </span>
        </button>
        <button type="button" aria-label="بیت بعدی" disabled={reader.index === count - 1} onClick={() => reader.step(1)} className={arrow}>
          <ChevronDownIcon size={22} lineWidth={2.6} />
        </button>
      </div>
    </div>
  );
}
