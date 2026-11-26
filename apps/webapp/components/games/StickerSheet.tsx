"use client";

import { motion } from "motion/react";
import { useRef, useState } from "react";
import type { JigsawSticker } from "../../lib/games/jigsawQuestion";
import { persianDigits } from "../../lib/persian";
import { WordSticker } from "../ui/WordSticker";

/**
 * One sticker of the sheet. It is tapped (it is in hand, then a slot takes it) or dragged: it follows the finger, which is physical, so it is the same in
 * right-to-left, and snaps back unless a slot takes it. Held (tapped or being dragged) it is bigger, tilted, red and lifted.
 */
function LooseSticker({ sticker, inHand, select, drop }: { sticker: JigsawSticker; inHand: boolean; select: (sticker: JigsawSticker) => void; drop: (sticker: JigsawSticker, point: { x: number; y: number }) => void }) {
  const [dragging, setDragging] = useState(false);
  const dragged = useRef(false);
  const held = inHand || dragging;
  return (
    <span className={`inline-block transition-transform duration-150 motion-reduce:transition-none ${held ? "-translate-y-3.5" : ""}`}>
      <motion.button
        type="button"
        drag
        dragSnapToOrigin
        dragMomentum={false}
        dragElastic={0}
        whileDrag={{ zIndex: 20 }}
        style={{ position: "relative" }}
        aria-pressed={inHand}
        data-testid={`sticker-${sticker.id}`}
        data-word={sticker.word}
        onPointerDown={() => (dragged.current = false)}
        onKeyDown={() => (dragged.current = false)}
        onDragStart={() => {
          dragged.current = true;
          setDragging(true);
        }}
        onDragEnd={(_, { point }) => {
          setDragging(false);
          drop(sticker, { x: point.x - window.scrollX, y: point.y - window.scrollY });
        }}
        // A click right after a drag is the drag's own end.
        onClick={() => (dragged.current ? (dragged.current = false) : select(sticker))}
        className="touch-none rounded-word"
      >
        <WordSticker word={sticker.word} status={held ? "held" : "onSheet"} size={24} />
      </motion.button>
    </span>
  );
}

/** «برگه‌ی برچسب‌ها»: the words still to place, loose on a sheet (Games/JigsawCard.swift `JigsawStickerSheet`). */
export function StickerSheet({ stickers, selected, extras, select, drop }: { stickers: JigsawSticker[]; selected?: JigsawSticker; extras: number; select: (sticker: JigsawSticker) => void; drop: (sticker: JigsawSticker, point: { x: number; y: number }) => void }) {
  return (
    <section data-testid="sticker-sheet" aria-label="برگه‌ی برچسب‌ها" className="flex flex-col gap-2.5 rounded-3xl border-2 border-dashed border-[#C9C4D4] bg-[#E7E4EE] px-3 pt-3.5 pb-[18px]">
      <p className="text-[13px] font-medium text-muted">{extras > 0 ? `برگه‌ی برچسب‌ها · ${persianDigits(extras)} تاش اضافه‌ست` : "برگه‌ی برچسب‌ها"}</p>
      <div className="flex min-h-14 flex-wrap justify-center gap-2.5">
        {stickers.map((sticker) => (
          <LooseSticker key={sticker.id} sticker={sticker} inHand={selected?.id === sticker.id} select={select} drop={drop} />
        ))}
      </div>
    </section>
  );
}
