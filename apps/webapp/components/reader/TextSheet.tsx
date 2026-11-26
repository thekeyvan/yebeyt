"use client";

import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack } from "@ui-sdk/react/slider";
import type { ReactNode } from "react";
import { canChooseWeight, clampSize, hemistichLayouts, readerFonts, sizeRange, spacings, themes, type TextSettings } from "../../lib/reader/settings";
import { persianDigits } from "../../lib/persian";
import { Segmented } from "../ui/Segmented";
import { Sheet } from "../ui/Sheet";
import { fontClass, themeClasses } from "./theme";

type Update = (change: Partial<TextSettings>) => void;

/** One of the «آ» in the sheet, drawn in Parastoo. */
const Aleph = ({ size, className }: { size: number; className?: string }) => (
  <span className={`font-poem ${className ?? ""}`} style={{ fontSize: size }} aria-hidden>
    آ
  </span>
);

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-[7px]">
      <p className="text-start text-[13px] font-bold text-muted">{title}</p>
      {children}
    </div>
  );
}

/** The size slider: small «آ» at the start, large at the end; the thumb moves towards the large one. */
function SizeSlider({ size, update }: { size: number; update: Update }) {
  return (
    <div className="flex w-full items-center gap-3 text-ink">
      <Aleph size={15} />
      <Slider value={size} min={sizeRange.min} max={sizeRange.max} step={1} onValueChange={(value) => update({ size: clampSize(value as number) })} className="flex-1">
        <SliderControl className="relative flex h-6 items-center">
          <SliderTrack className="relative h-1.5 w-full rounded-pill bg-track-light">
            <SliderIndicator className="absolute inset-y-0 rounded-pill bg-lapis" />
            <SliderThumb aria-label="اندازه‌ی حروف" aria-valuetext={persianDigits(size)} className="size-6 rounded-full border-4 border-lapis bg-white shadow-[0_2px_3px_rgba(20,17,43,0.25)]" />
          </SliderTrack>
        </SliderControl>
      </Slider>
      <Aleph size={26} />
    </div>
  );
}

/**
 * The «آ» sheet (Reader/TextSheet.swift): size, font, weight, hemistich layout, line spacing and theme. Every change applies at once to the reader
 * behind it and is kept in this browser.
 */
export function TextSheet({ open, onClose, settings, update }: { open: boolean; onClose: () => void; settings: TextSettings; update: Update }) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      header={(Title) => (
        <div className="flex w-full items-center justify-between">
          <Title className="font-title text-[22px] leading-[1.3]">متن</Title>
          <button type="button" onClick={onClose} className="text-sm font-bold text-lapis">
            تمام
          </button>
        </div>
      )}
    >
      <SizeSlider size={settings.size} update={update} />
      <div role="radiogroup" aria-label="قلم" className="-mx-1 flex w-full gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {readerFonts.map(({ id, title }) => {
          const chosen = settings.font === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={chosen}
              aria-label={title}
              onClick={() => update({ font: id })}
              className={`flex w-[86px] shrink-0 flex-col items-center rounded-2xl border-[3px] bg-white px-1 pt-1.5 pb-[5px] ${chosen ? "border-lapis" : "border-chip-border"}`}
            >
              <span className={`${fontClass({ font: id, bold: true })} leading-[1.7] text-ink`} style={{ fontSize: 21 }}>
                بیت
              </span>
              <span className={`text-[11px] ${chosen ? "font-bold text-lapis" : "font-medium text-muted"}`}>{title}</span>
            </button>
          );
        })}
      </div>
      <Row title="وزن قلم">
        <Segmented
          look="row"
          label="وزن قلم"
          disabled={!canChooseWeight(settings)}
          value={settings.bold ? "bold" : "regular"}
          onValueChange={(value) => update({ bold: value === "bold" })}
          options={[
            { value: "regular", label: "معمولی", leading: <span className="font-poem-regular text-lg leading-none">بیت</span> },
            { value: "bold", label: "پررنگ", leading: <span className="font-poem text-lg leading-none">بیت</span> },
          ]}
        />
      </Row>
      <Row title="چینش مصراع‌ها">
        <Segmented
          look="row"
          label="چینش مصراع‌ها"
          value={settings.layout}
          onValueChange={(layout) => update({ layout })}
          options={hemistichLayouts.map(({ id, title }) => ({
            value: id,
            label: title,
            leading: (
              <span aria-hidden className="flex w-[22px] flex-col gap-[3px]">
                <span className={`h-[3px] w-3.5 rounded-sm bg-current ${id === "staggered" ? "self-start" : "self-center"}`} />
                <span className={`h-[3px] w-3.5 rounded-sm bg-current ${id === "staggered" ? "self-end" : "self-center"}`} />
              </span>
            ),
          }))}
        />
      </Row>
      <Row title="فاصله‌ی خط‌ها">
        <Segmented look="row" label="فاصله‌ی خط‌ها" value={settings.spacing} onValueChange={(spacing) => update({ spacing })} options={spacings.map(({ id, title }) => ({ value: id, label: title }))} />
      </Row>
      <div role="radiogroup" aria-label="زمینه" className="flex w-full gap-2">
        {themes.map(({ id, title }) => {
          const look = themeClasses[id];
          const chosen = settings.theme === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={chosen}
              aria-label={title}
              onClick={() => update({ theme: id })}
              className={`flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[14px] border-[3px] text-[13px] ${look.page} ${look.text} ${chosen ? "border-lapis font-bold" : "border-track-light font-medium"}`}
            >
              <Aleph size={18} />
              {title}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
