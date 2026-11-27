"use client";

import Link from "next/link";
import { cn } from "../../lib/cn";
import type { ResolvedCouplet } from "../../lib/messages/resolver";
import { routeURL } from "../../lib/reader/route";
import { CoupletText } from "../reader/CoupletText";
import { useCouplet } from "./useCouplet";

/** The chat's cards are always the board's: Parastoo Bold, centred. */
const cardText = { font: "parastoo", bold: true, layout: "centered", spacing: "normal" } as const;

/**
 * The white card of a couplet: its two hemistichs, the poet's chip and «کل شعر». The other person's has the amber «برای تو» sticker. A tap opens the poem at it
 * (Messages/ChatBubbles.swift `CoupletCardView`); the couplet is read by its key, and a card whose poem can't be loaded stays «…».
 */
export function CoupletCard({ coupletKey, id, mine }: { coupletKey: string; id: string; mine: boolean }) {
  const resolved = useCouplet(coupletKey);
  const card = cn("relative block w-[262px] max-w-full bg-white px-4 pt-[18px] pb-3 shadow-[0_3px_8px_rgba(20,17,43,0.14)]", mine ? "rounded-[22px] rounded-se-[6px]" : "rounded-[22px] rounded-ss-[6px]");
  if (!resolved) {
    return (
      <div data-testid={`couplet-card-${id}`} className={card}>
        <p className="py-5 text-center text-lg text-muted">…</p>
      </div>
    );
  }
  return (
    <Link href={routeURL(resolved.path, resolved.index, "couplet")} data-testid={`couplet-card-${id}`} aria-label={`${resolved.couplet.m1}، ${resolved.couplet.m2}، ${resolved.poetName} · ${resolved.title}`} className={card}>
      <Card resolved={resolved} />
      {!mine && (
        <span aria-hidden className="absolute -top-3 end-3.5 -rotate-[9deg] rounded-full border-[3px] border-white bg-amber px-2.5 pt-1 pb-0.5 font-title text-sm text-ink shadow-badge">
          برای تو
        </span>
      )}
    </Link>
  );
}

function Card({ resolved }: { resolved: ResolvedCouplet }) {
  return (
    <>
      <CoupletText couplet={resolved.couplet} settings={cardText} size={18} factor={1.7} className="text-ink" />
      <span className="mt-1 flex items-center justify-between pt-1">
        <span className="rounded-full bg-magenta px-2.5 py-0.5 text-xs font-bold text-white">{resolved.poetName}</span>
        <span className="text-xs font-bold text-lapis">کل شعر</span>
      </span>
    </>
  );
}
