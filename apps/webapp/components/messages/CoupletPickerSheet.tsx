"use client";

import { useEffect, useState } from "react";
import { feedbackPrivate } from "../../lib/feedbackPrivate";
import { useCorpus, useStore } from "../../lib/library/browser";
import { normalize } from "../../lib/library/normalize";
import type { CoupletEntry } from "../../lib/library/search";
import { maxNoteLength } from "../../lib/messages/chat";
import { limited } from "../../lib/messages/copy";
import { useServices } from "../account/useServices";
import { useDivanEntries } from "../me/useDivanEntries";
import { usePoetName } from "./useCouplet";
import { SearchBox } from "../library/chrome";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

/** A couplet the picker offers: from the divan, or found in the bundled books. */
type Item = { key: string; m1: string; m2: string; source: string };

const settleMs = 250;

function Card({ item }: { item: Item }) {
  return (
    <div className="flex w-full flex-col gap-1 rounded-[20px] bg-white px-4 pt-3 pb-2.5 text-start shadow-[0_3px_6px_rgba(20,17,43,0.06)]">
      <span className="font-poem text-base leading-[2.1] text-ink">
        <span className="block text-start">{item.m1}</span>
        {item.m2 && <span className="block text-end">{item.m2}</span>}
      </span>
      <span className="text-[11px] text-[#8A8698]">{item.source}</span>
    </div>
  );
}

/**
 * Choose a couplet (from the divan, or by searching the bundled books), add a note if you like, and hand it on: «بیت بفرست» in a chat, «یه بیت اضافه کن» in a shared
 * divan (Messages/CoupletPickerSheet.swift).
 */
export function CoupletPickerSheet({ open, onClose, title, action, choose }: { open: boolean; onClose: () => void; title: string; action: string; choose: (key: string, note: string) => void }) {
  const services = useServices();
  useStore(services?.marks);
  const { entries } = useDivanEntries(services?.marks.keptItems() ?? []);
  const { value: corpus } = useCorpus();
  const poetName = usePoetName();
  const [query, setQuery] = useState("");
  const [settled, setSettled] = useState("");
  const [selected, setSelected] = useState<Item>();
  const [note, setNote] = useState("");

  // Each time the sheet opens it starts fresh.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSettled("");
    setSelected(undefined);
    setNote("");
  }, [open]);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query), settleMs);
    return () => clearTimeout(timer);
  }, [query]);

  const searching = normalize(settled) !== "";
  const fromDivan: Item[] = entries.map((entry) => ({ key: entry.key, m1: entry.couplet.m1, m2: entry.couplet.m2, source: `${poetName(entry.poetSlug)} · ${entry.title}` }));
  const found: Item[] = searching && corpus ? corpus.search(settled, 30).map((entry: CoupletEntry) => ({ key: entry.id, m1: entry.couplet.m1, m2: entry.couplet.m2, source: `${poetName(entry.poet)} · ${entry.title}` })) : [];
  const items = searching ? found : fromDivan;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()} title={title}>
      {selected ? (
        <div className="flex w-full flex-col gap-3.5">
          <Card item={selected} />
          <input
            {...feedbackPrivate}
            data-testid="picker-note"
            value={note}
            onChange={(event) => setNote(limited(event.target.value, maxNoteLength))}
            aria-label="یه یادداشت (اختیاری)"
            placeholder="یه یادداشت (اختیاری)"
            className="h-12 rounded-full bg-white px-4 text-[15px] text-ink shadow-[0_2px_4px_rgba(20,17,43,0.12)] outline-none placeholder:text-[#8A8698]"
          />
          <div className="flex items-center gap-2.5">
            <Button
              data-testid="picker-send"
              onClick={() => {
                choose(selected.key, note);
                onClose();
              }}
            >
              {action}
            </Button>
            <button type="button" onClick={() => setSelected(undefined)} className="px-2 text-sm font-bold text-lapis">
              بیت دیگه
            </button>
          </div>
        </div>
      ) : (
        <div className="flex max-h-[60dvh] w-full flex-col gap-3.5">
          <div {...feedbackPrivate}>
            <SearchBox round value={query} onChange={setQuery} placeholder="یه تیکه از بیت…" />
          </div>
          <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto pb-2">
            {!searching && <h3 className="font-ui text-[13px] font-bold text-muted">از دیوانت</h3>}
            {!searching && fromDivan.length === 0 && <p className="text-sm text-muted">دیوانت هنوز خالیه؛ بالا دنبال یه بیت بگرد.</p>}
            {searching && corpus && found.length === 0 && <p className="text-sm text-muted">چیزی پیدا نشد.</p>}
            {items.map((item) => (
              <button key={item.key} type="button" data-testid={`pick-${item.key}`} onClick={() => setSelected(item)}>
                <Card item={item} />
              </button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
