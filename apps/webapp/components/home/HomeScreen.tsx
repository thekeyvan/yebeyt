"use client";

import { useEffect, useRef, useState } from "react";
import { useHome } from "../../lib/library/browser";
import { dateLine } from "../../lib/library/date";
import { pickId, rejectedLine } from "../../lib/library/home";
import { today } from "../../lib/library/today";
import { Screen } from "../shell/Screen";
import { toast } from "../ui/Toast";
import { DeckCard } from "./DeckCard";

/** How long a new card keeps springing in before «dealing» ends, so the next «رد کن» works at once. */
const dealMs = 600;

/** The home tab: the date, «بیتِ امروز» and its card (Home/HomeView.swift). «دوستات» comes with the friends (W6). */
export function HomeScreen() {
  const { state, model } = useHome();
  const [dealing, setDealing] = useState(false);
  const dealReset = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [date, setDate] = useState("");
  const day = state?.day;
  // The date is the browser's (and the debug day's), so it is drawn once the page is in the browser.
  useEffect(() => setDate(dateLine(today())), [day]);
  useEffect(() => () => clearTimeout(dealReset.current), []);
  const pick = state?.pick;

  async function reject() {
    if (!model) return;
    const rejectedDay = model.snapshot().day;
    clearTimeout(dealReset.current);
    setDealing(true);
    await model.reject();
    toast(rejectedLine, { run: () => void model.undoReject(rejectedDay) });
    dealReset.current = setTimeout(() => setDealing(false), dealMs); // without waiting: the next «رد کن» works at once
  }

  return (
    <Screen>
      <div className="flex flex-col gap-4">
        <div>
          <p data-testid="date" className="min-h-[1.8em] text-[13px] text-muted">
            {date}
          </p>
          <h1 className="text-[32px] leading-[1.3] text-ink">بیتِ امروز</h1>
        </div>
        {pick && <DeckCard key={pickId(pick)} pick={pick} dealing={dealing} onReject={reject} />}
      </div>
    </Screen>
  );
}
