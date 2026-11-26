"use client";

import { AccessoryIcon, AvatarFace, BACKGROUNDS, HAIRS, SKINS, type Accessory, type AvatarParts } from "@yebeyt/avatar";
import { cn } from "../../lib/cn";
import { accessoryUnlockText, choosing, isUnlocked, optionsFor, type AvatarOption, type AvatarPart, type AvatarProgress } from "../../lib/me/avatarCatalogue";
import { LockIcon } from "./icons";

const swatches: Partial<Record<AvatarPart, Record<string, string>>> = { face: SKINS, hair: HAIRS, background: BACKGROUNDS };

function Preview({ part, option, draft, progress }: { part: AvatarPart; option: AvatarOption; draft: AvatarParts; progress: AvatarProgress }) {
  if (part === "accessory") return <AccessoryIcon accessory={option.id as Accessory} />;
  const colour = swatches[part]?.[option.id];
  if (colour) return <span className="block size-11 rounded-full border-2 border-ring" style={{ background: colour }} />;
  return (
    <span className="block size-20">
      <AvatarFace avatar={choosing(option.id, part, draft, progress) ?? draft} />
    </span>
  );
}

/** The choices of one part, three to a row (the accessories with lock badges and their unlock text): the chosen one has a lapis border, a locked one cannot be chosen (Me/Avatar/AvatarScreen.swift `grid`). */
export function AvatarGrid({ part, draft, progress, onChoose }: { part: AvatarPart; draft: AvatarParts; progress: AvatarProgress; onChoose: (next: AvatarParts) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {optionsFor(part).map((option) => {
        const locked = part === "accessory" && !isUnlocked(option.id, progress);
        const chosen = draft[part] === option.id;
        const unlock = locked ? accessoryUnlockText(option.id) : undefined;
        return (
          <button
            key={option.id}
            type="button"
            aria-label={unlock ? `${option.title}، قفله، ${unlock}` : option.title}
            aria-pressed={chosen}
            data-testid={`avatar-item-${option.id}`}
            onClick={() => {
              const next = choosing(option.id, part, draft, progress);
              if (next) onChoose(next);
            }}
            className={cn("relative flex h-[108px] flex-col items-center justify-center gap-1 rounded-[18px] border-4 bg-white p-1.5 shadow-[0_2px_8px_rgba(20,17,43,0.12)]", chosen ? "border-lapis" : "border-white")}
          >
            <span className={cn("flex", locked && "opacity-55")}>
              <Preview part={part} option={option} draft={draft} progress={progress} />
            </span>
            {part === "accessory" && <span className="text-xs font-bold text-ink">{option.title}</span>}
            {unlock && <span className="text-center text-[10px] leading-[1.6] text-muted">{unlock}</span>}
            {locked && (
              <span aria-hidden className="absolute end-1.5 top-1.5 grid size-[22px] place-items-center rounded-full bg-ink text-white">
                <LockIcon size={12} lineWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
