"use client";

import { creditGroups } from "../../lib/me/licenses";
import { Screen } from "../shell/Screen";
import { MeCard, MeHeader } from "./chrome";

/** مجوزها: the fonts, the poetry and the libraries the app uses, from THIRD_PARTY_NOTICES.md (Me/Settings/LicensesScreen.swift). The credits are in English, so they read left to right. */
export function LicensesScreen() {
  return (
    <Screen header={<MeHeader title="مجوزها" />}>
      <div className="flex flex-col gap-3.5">
        {creditGroups.map((group) => (
          <MeCard key={group.title} role="group" aria-label={group.title} className="px-4 pt-2.5 pb-1.5">
            <h2 className="pt-1 pb-1.5 font-ui text-[13px] font-bold text-lapis">{group.title}</h2>
            {group.credits.map((credit) => (
              <div key={credit.name} dir="ltr" className="py-2 text-start">
                <p className="text-sm font-medium text-ink">{credit.name}</p>
                <p className="text-xs leading-[1.7] text-muted">{credit.by}</p>
                <p className="text-xs leading-[1.7] text-muted">{credit.license}</p>
              </div>
            ))}
          </MeCard>
        ))}
      </div>
    </Screen>
  );
}
