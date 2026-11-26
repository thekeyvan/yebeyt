"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Services } from "../../lib/account/services";
import { devPagesEnabled } from "../../lib/dev";
import { reloadHome, useStore } from "../../lib/library/browser";
import { debugStep, OnboardingModel } from "../../lib/onboarding/model";
import { UsernameStep } from "../account/UsernameStep";
import { OnbAccount } from "./OnbAccount";
import { OnbFriends } from "./OnbFriends";
import { OnbGame } from "./OnbGame";
import { OnbScreen } from "./chrome";
import { OnbTaste } from "./OnbTaste";
import { OnbWelcome } from "./OnbWelcome";

/** The username step in the onboarding frame (Onboarding/OnboardingFlow.swift): «همینه» goes on to the friends. */
function OnbUsername({ onboarding }: { onboarding: OnboardingModel }) {
  return (
    <OnbScreen step="username" header={<div className="h-11" />} footer={null}>
      {() => <UsernameStep onSaved={() => onboarding.next()} />}
    </OnbScreen>
  );
}

/**
 * Onboarding, in front of everything else: it shows on the first visit to the home, as a release build of the phone does on its first launch, and never again once it
 * is finished or skipped (or someone signed in). A build with the debug pages shows none unless `sessionStorage.beytOnboarding` asks (`OnboardingModel.debugStep`).
 */
export function OnboardingHost({ services }: { services: Services }) {
  const { session, account, taste, scores } = services;
  const pathname = usePathname();
  const status = useStore(session)?.status;
  const [onboarding, setOnboarding] = useState<OnboardingModel>();

  useEffect(() => {
    if (onboarding || status === "loading") return;
    const debug = debugStep(sessionStorage, devPagesEnabled());
    const start = debug === "first" || (debug === undefined && !devPagesEnabled()) ? (pathname === "/" && status === "guest" ? OnboardingModel.firstStep(localStorage) : undefined) : debug;
    if (start) setOnboarding(new OnboardingModel(start, localStorage, start === "account"));
  }, [onboarding, pathname, status]);

  const state = useStore(onboarding);
  const step = state?.step;
  const running = step !== undefined;
  const [wasRunning, setWasRunning] = useState(false);

  // When it ends, today's couplet is picked again from the poets that were chosen.
  useEffect(() => {
    if (running) setWasRunning(true);
    else if (wasRunning) {
      setWasRunning(false);
      reloadHome();
    }
  }, [running, wasRunning]);

  if (!onboarding || !step) return null;
  switch (step) {
    case "welcome":
      return <OnbWelcome onboarding={onboarding} />;
    case "taste":
      return <OnbTaste onboarding={onboarding} taste={taste} />;
    case "game":
      return <OnbGame onboarding={onboarding} taste={taste} scores={scores} />;
    case "account":
      return <OnbAccount onboarding={onboarding} account={account} />;
    case "username":
      return <OnbUsername onboarding={onboarding} />;
    case "friends":
      return <OnbFriends onboarding={onboarding} username={session.user?.username ?? ""} />;
  }
}
