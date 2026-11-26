import type { ReactNode } from "react";
import type { GameKind } from "../../lib/games/kinds";
import type { Library } from "../../lib/library/library";
import { PoetCircle } from "../library/PoetCircle";

// The little picture on a catalog card: a tiny mock of the game's core screen, drawn from the shapes of the app (the boards' `MOCK` in
// design/canvas/gen_games.py, smaller; Games/GamePreview.swift). Decorative: fixed sizes, hidden from screen readers.

const poem = "font-poem leading-[1.3]";

function Word({ text, fill = "bg-lapis", ink = "text-white", tilt }: { text: string; fill?: string; ink?: string; tilt?: number }) {
  return (
    <span className={`${poem} whitespace-nowrap rounded-[7px] border-[1.5px] border-white px-[5px] py-px text-[10px] shadow-[0_1px_2px_rgba(20,17,43,0.18)] ${fill} ${ink}`} style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined }}>
      {text}
    </span>
  );
}

const Slot = () => <span className="h-4 w-3.5 rounded-[5px] border-[1.5px] border-dashed border-ring" />;

function Pill({ text, right }: { text: string; right?: boolean }) {
  return <span className={`${poem} w-full truncate rounded-lg px-1 py-0.5 text-center text-[9px] text-ink ${right ? "bg-green" : "bg-paper"}`}>{text}</span>;
}

function Letter({ text, filled }: { text: string; filled: boolean }) {
  return <span className={`grid h-4 w-3.5 place-items-center rounded-[4px] border-[1.5px] border-lapis text-[8px] font-bold text-white ${filled ? "bg-lapis" : "bg-white"}`}>{text}</span>;
}

function Key({ text, used }: { text: string; used: boolean }) {
  return <span className={`grid size-3.5 place-items-center rounded-[4px] text-[8px] font-bold ${used ? "bg-paper text-ring" : "bg-white text-ink shadow-[0_1px_2px_rgba(20,17,43,0.18)]"}`}>{text}</span>;
}

const Dot = ({ fill, size }: { fill: string; size: number }) => <span className={`rounded-full border-2 border-white shadow-[0_1px_2px_rgba(20,17,43,0.18)] ${fill}`} style={{ width: size, height: size }} />;

function PoetFace({ library, slug, name, right }: { library: Library; slug: string; name: string; right?: boolean }) {
  const poet = library.poet(slug);
  return (
    <span className="flex w-5 flex-col items-center gap-px">
      {poet && <PoetCircle poet={poet} size={20} border={2} />}
      <span className={`whitespace-nowrap text-[7px] ${right ? "font-bold text-[#3E9A1E]" : "font-medium text-ink"}`}>{name}</span>
    </span>
  );
}

const books = [
  { title: "مثنوی", fill: "bg-amber", height: 26, right: true },
  { title: "دیوان شمس", fill: "bg-magenta", height: 22 },
  { title: "فیه ما فیه", fill: "bg-[#1C20B8]", height: 19 },
];

function mock(kind: GameKind, library: Library): ReactNode {
  switch (kind) {
    case "daily":
      return (
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex gap-[3px]">
            <Letter text="م" filled />
            <Letter text="ص" filled />
            <Letter text="" filled={false} />
            <Letter text="" filled={false} />
          </div>
          <div className="flex gap-[3px]">
            {[["ل", false], ["م", true], ["ر", false], ["ا", false], ["ص", true]].map(([text, used]) => (
              <Key key={String(text)} text={String(text)} used={Boolean(used)} />
            ))}
          </div>
        </div>
      );
    case "jigsaw":
      return (
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex gap-[3px]">
            <Word text="بنی" />
            <Word text="آدم" />
            <Slot />
            <Slot />
          </div>
          <div className="flex gap-1.5">
            <Word text="یکدیگرند" fill="bg-white" ink="text-ink" tilt={-6} />
            <Word text="اعضای" fill="bg-fire" tilt={5} />
          </div>
        </div>
      );
    case "poet":
      return (
        <div className="flex gap-0.5">
          <PoetFace library={library} slug="hafez" name="حافظ" />
          <PoetFace library={library} slug="saadi" name="سعدی" />
          <PoetFace library={library} slug="moulavi" name="مولانا" right />
          <PoetFace library={library} slug="khayyam" name="خیام" />
        </div>
      );
    case "misra":
      return (
        <div className="flex w-full flex-col items-center gap-1">
          <span className={`${poem} max-w-full truncate text-[10px] text-ink`}>بنی آدم اعضای یکدیگرند</span>
          <Pill text="که در آفرینش ز یک گوهرند" right />
          <Pill text="که از جان و دل یار یکدیگرند" />
        </div>
      );
    case "book":
      return (
        <div className="flex flex-col items-center gap-1">
          <span className="flex items-center gap-[3px] rounded-full bg-white py-px ps-[7px] pe-0.5 text-[8px] font-bold text-ink">
            مولانا
            {library.poet("moulavi") && <PoetCircle poet={library.poet("moulavi")!} size={14} border={1.5} />}
          </span>
          <div className="flex items-end gap-1">
            {books.map(({ title, fill, height, right }) => (
              <span key={title} className="flex w-[26px] flex-col items-center gap-0.5">
                <span className={`w-[18px] rounded-[3px] ${fill} ${right ? "outline-2 outline-offset-0 outline-green" : ""}`} style={{ height }} />
                <span className="whitespace-nowrap text-[7px] text-ink">{title}</span>
              </span>
            ))}
          </div>
        </div>
      );
    case "match":
      return (
        <div className="flex items-center">
          <div className="flex flex-col gap-1.5"><Pill text="گلگشت" /><Pill text="مصلا" /></div>
          <svg aria-hidden width="18" height="34" viewBox="0 0 18 34" fill="none" stroke="var(--color-lapis)" strokeWidth="2"><path d="M18 6.8C9 6.8 9 27.2 0 27.2" /></svg>
          <div className="flex flex-col gap-1.5"><Pill text="جای نماز" /><Pill text="گردشگاه" right /></div>
        </div>
      );
    case "listen":
      return (
        <div className="flex w-full flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="grid size-5 place-items-center rounded-full bg-lapis">
              <svg aria-hidden width="7" height="8" viewBox="0 0 7 8" fill="var(--color-white)"><path d="M0 0l7 4-7 4z" /></svg>
            </span>
            <span className="flex items-center gap-[1.5px]">
              {[5, 9, 14, 8, 12, 16, 7, 11, 15, 8].map((height, index) => <span key={index} className="w-0.5 rounded-full bg-lapis" style={{ height }} />)}
            </span>
          </div>
          <Pill text="کنار آب رکن آباد" right />
        </div>
      );
    case "mosh":
      return (
        <div className="flex w-full flex-col gap-[5px]">
          <span className={`${poem} self-start truncate rounded-[9px] bg-white px-[7px] py-0.5 text-[9px] text-ink`}>یاد باد آن که نهانت</span>
          <span className={`${poem} self-end truncate rounded-[9px] bg-lapis px-[7px] py-0.5 text-[9px] text-white`}>دل می‌رود ز دستم</span>
        </div>
      );
    case "duel":
      return (
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-[3px] text-ink">
            <Dot fill="bg-amber" size={18} />
            <span className="font-title text-[13px]">۳</span>
            <span className="text-[7px] text-[#8A8698]">در برابر</span>
            <span className="font-title text-[13px]">۲</span>
            <Dot fill="bg-magenta" size={18} />
          </div>
          <div className="flex gap-[3px]">
            {["bg-green", "bg-green", "bg-fire", "bg-green", "bg-ring"].map((fill, index) => <span key={index} className={`h-[5px] w-3 rounded-full ${fill}`} />)}
          </div>
        </div>
      );
  }
}

/** A card's picture of its game: 72 high on the board's paper. */
export function GamePreview({ kind, library }: { kind: GameKind; library: Library }) {
  return (
    <div aria-hidden className="flex h-[72px] items-center justify-center overflow-hidden rounded-[14px] bg-board-paper px-[3px]">
      {mock(kind, library)}
    </div>
  );
}
