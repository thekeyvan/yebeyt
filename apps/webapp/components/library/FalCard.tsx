"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { libraryData } from "../../lib/library/browser";
import { falPoem } from "../../lib/library/fal";
import { usePress } from "../../lib/motion";
import { routeURL } from "../../lib/reader/route";
import { BookIcon } from "../ui/icons";

/** «فال حافظ»: «باز کن» opens a random Hafez ghazal in the whole-poem view (the fal has no flow of its own yet) (Explore/FalCard.swift). */
export function FalCard() {
  const router = useRouter();
  const press = usePress();

  async function open() {
    try {
      const { library, indexes } = await libraryData();
      const hafez = library.bookAt("/hafez");
      const poem = hafez && falPoem(hafez, await indexes.index(hafez));
      if (poem) router.push(routeURL(poem.path, 0, "scroll"));
    } catch {
      // The library did not load: the card does nothing, and a tap tries again.
    }
  }

  return (
    <motion.button
      type="button"
      {...press}
      onClick={open}
      aria-label="فال حافظ، باز کن"
      data-testid="fal"
      className="flex w-full items-center gap-3.5 rounded-[26px] border-[5px] border-white bg-lapis px-4 py-3.5 text-start text-white shadow-[0_4px_14px_rgba(20,17,43,0.2)]"
    >
      <span aria-hidden className="grid size-[54px] shrink-0 -rotate-[8deg] place-items-center rounded-full border-4 border-white bg-amber text-ink shadow-[0_2px_6px_rgba(20,17,43,0.25)]">
        <BookIcon size={26} lineWidth={2} />
      </span>
      <span aria-hidden className="min-w-0 flex-1">
        <span className="block truncate font-title text-2xl leading-[1.4]">فال حافظ</span>
        <span className="block text-[13px] text-[#D6D8FF]">یه نیت کن، دیوان رو باز کن</span>
      </span>
      <span aria-hidden className="rounded-[14px] bg-white px-3.5 pt-2 pb-1 font-title text-[17px] leading-[1.4] text-lapis">
        باز کن
      </span>
    </motion.button>
  );
}
