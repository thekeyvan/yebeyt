"use client";

import { AvatarFace, type AvatarParts } from "@yebeyt/avatar";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "../../lib/cn";
import type { Services } from "../../lib/account/services";
import { useGameStats } from "../../lib/games/browser";
import { accessoryCard, choosing, optionsFor, partChips, type AvatarPart } from "../../lib/me/avatarCatalogue";
import { canGoBack } from "../../lib/nav";
import { usePress } from "../../lib/motion";
import { BackButton } from "../library/chrome";
import { Screen } from "../shell/Screen";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { DiceIcon } from "../ui/icons";
import { AvatarGrid } from "./AvatarGrid";
import { MeCard } from "./chrome";
import { useAvatarParts } from "./useAvatarParts";
import { WithServices } from "./WithServices";

/** The question before leaving a face that was not saved. */
export const avatarCopy = { title: "چهره‌ات ذخیره نشده. ولش کنی؟", discard: "ول کن", stay: "بمون" };

/** چهره‌ی تو: the big face, a chip for each part, the choices of that part and the couplet of the chosen accessory. «ذخیره» saves it (Me/Avatar/AvatarScreen.swift). */
export function AvatarScreen() {
  return <WithServices>{(services) => <Editor services={services} />}</WithServices>;
}

function Editor({ services }: { services: Services }) {
  const router = useRouter();
  const press = usePress();
  const saved = useAvatarParts(services);
  const stats = useGameStats();
  const [draft, setDraft] = useState<AvatarParts>(saved);
  const [part, setPart] = useState<AvatarPart>("accessory");
  const [asking, setAsking] = useState(false);
  const progress = { bookWins: services.achievements.bookWins, bestStreak: stats.bestStreak };
  const unsaved = partChips.some(({ part: each }) => draft[each] !== saved[each]);
  const leave = () => (canGoBack() ? router.back() : router.push("/me"));
  const card = part === "accessory" ? accessoryCard(draft.accessory) : undefined;

  /** The dice: a random choice for every part, the accessory among the unlocked ones. */
  function shuffle() {
    let next = draft;
    for (const { part: each } of partChips) {
      const open = optionsFor(each).filter(({ id }) => choosing(id, each, next, progress));
      const pick = open[Math.floor(Math.random() * open.length)];
      if (pick) next = { ...next, [each]: pick.id };
    }
    setDraft(next);
  }

  return (
    <Screen
      header={
        <div className="flex items-center gap-3">
          <BackButton fallback="/me" onBack={unsaved ? () => setAsking(true) : undefined} />
          <h1 className="flex-1 text-[30px] leading-[1.3] text-ink">چهره‌ی تو</h1>
          <motion.button
            type="button"
            {...press}
            data-testid="avatar-save"
            onClick={() => {
              services.avatar.save(draft); // saved at once, sent in the background
              leave();
            }}
            className="rounded-2xl border-4 border-white bg-lapis px-4 pt-1.5 pb-0.5 font-title text-lg text-white shadow-[0_2px_8px_rgba(20,17,43,0.22)]"
          >
            ذخیره
          </motion.button>
        </div>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex justify-center py-1">
          <div className="relative size-[210px]" data-testid="avatar-draft">
            <span aria-hidden className="block size-full rounded-full bg-white p-[7px] shadow-[0_4px_16px_rgba(20,17,43,0.18)]">
              <AvatarFace avatar={draft} />
            </span>
            <motion.button
              type="button"
              {...press}
              aria-label="چهره‌ی تصادفی"
              data-testid="avatar-shuffle"
              onClick={shuffle}
              className="absolute end-1.5 bottom-1.5 grid size-[46px] place-items-center rounded-full border-4 border-white bg-amber text-ink shadow-[0_2px_8px_rgba(20,17,43,0.22)]"
            >
              <DiceIcon size={20} lineWidth={2.4} />
            </motion.button>
          </div>
        </div>
        <div role="group" aria-label="بخش‌ها" className="-mx-[18px] flex gap-2 overflow-x-auto px-[18px] pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {partChips.map((chip) => (
            <button
              key={chip.part}
              type="button"
              aria-pressed={chip.part === part}
              data-testid={`avatar-part-${chip.part}`}
              onClick={() => setPart(chip.part)}
              className={cn("shrink-0 rounded-full px-[13px] py-[7px] text-[13px] shadow-[0_2px_3px_rgba(20,17,43,0.12)]", chip.part === part ? "bg-lapis font-bold text-white" : "bg-white font-medium text-ink")}
            >
              {chip.title}
            </button>
          ))}
        </div>
        <AvatarGrid part={part} draft={draft} progress={progress} onChoose={setDraft} />
        {card && (
          <MeCard data-testid="avatar-couplet" className="px-3.5 py-3">
            <p className="text-xs font-bold text-lapis">{card.source}</p>
            <p className="font-poem text-[17px] leading-[2.1] text-ink">{card.couplet}</p>
          </MeCard>
        )}
      </div>
      <ConfirmSheet open={asking} onOpenChange={setAsking} title={avatarCopy.title} confirm={avatarCopy.discard} cancel={avatarCopy.stay} onConfirm={leave} />
    </Screen>
  );
}
