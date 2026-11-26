"use client";

import { cn } from "../../lib/cn";
import type { Services } from "../../lib/account/services";
import { Screen } from "../shell/Screen";
import { MeCard, MeHeader } from "./chrome";
import { BadgeSticker } from "./BadgeSticker";
import { useBadges } from "./useBadges";
import { WithServices } from "./WithServices";

/** «نشان‌ها»: every badge with the rule that earns it (Me/Profile/BadgesScreen.swift). */
export function BadgesScreen() {
  return <WithServices>{(services) => <Badges services={services} />}</WithServices>;
}

function Badges({ services }: { services: Services }) {
  const badges = useBadges(services);
  return (
    <Screen header={<MeHeader title="نشان‌ها" />}>
      <MeCard className="px-4 py-1">
        <ul className="divide-y divide-chip-border">
          {badges.map((badge) => (
            <li key={badge.id} data-testid={`badge-${badge.id}`} data-earned={badge.earned} className="flex items-center gap-3.5 py-3">
              <BadgeSticker badge={badge} />
              <div className="min-w-0 flex-1">
                <p className={cn("text-[15px] font-bold", badge.earned ? "text-ink" : "text-muted")}>{badge.title}</p>
                <p className="text-[13px] leading-[1.8] text-muted">{badge.rule}</p>
              </div>
              <span className="sr-only">{badge.earned ? "گرفتی" : "قفله"}</span>
            </li>
          ))}
        </ul>
      </MeCard>
    </Screen>
  );
}
