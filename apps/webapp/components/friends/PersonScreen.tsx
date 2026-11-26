"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { Services } from "../../lib/account/services";
import { buttonsOf, friendCopy, isMain, titleOf } from "../../lib/friends/friendship";
import { leagueName } from "../../lib/friends/leaderboardLayout";
import { nameOf } from "../../lib/friends/models";
import { PersonModel } from "../../lib/friends/person";
import { useStore } from "../../lib/library/browser";
import { standardParts } from "../../lib/me/avatarCatalogue";
import { canGoBack } from "../../lib/nav";
import { persianDigits } from "../../lib/persian";
import { BackButton } from "../library/chrome";
import { FaceCircle } from "../me/FaceCircle";
import { WithServices } from "../me/WithServices";
import { Screen } from "../shell/Screen";
import { Button } from "../ui/Button";
import { toast } from "../ui/Toast";
import { Busy, Note } from "./chrome";
import { PersonMenu } from "./PersonMenu";
import { useFriendAsk } from "./useFriendAsk";

/**
 * Another person's page: Profile without the private parts (Friends/PersonScreen.swift). Face, name, @username, «<n> دوست», the league, then the button of the
 * friendship («درخواست دوستی», «درخواست فرستادی», «قبول» with «رد», or the chip «دوستین») and a ⋯ menu with «حذف از دوستا» (for a friend), «بلاک» and «گزارش».
 * «پیام بده» comes with the messages (W7).
 */
export function PersonScreen({ username }: { username: string }) {
  return <WithServices>{(services) => <Person services={services} username={username} />}</WithServices>;
}

function Person({ services, username }: { services: Services; username: string }) {
  const router = useRouter();
  const model = useMemo(() => new PersonModel(username, services.api, toast, services.friends), [services, username]);
  const { profile, phase, isBusy } = useStore(model)!;
  const { status } = useStore(services.session)!;
  const { friendsRevision } = useStore(services.friends)!;
  const signedIn = status === "in";
  // A guest has no page to read yet: the face of nobody and a button that asks for the account.
  useEffect(() => {
    if (signedIn) void model.load();
  }, [model, signedIn, friendsRevision]);

  const name = profile ? nameOf(profile) : username;
  const { ask, sheet } = useFriendAsk(async (action) => {
    if (!model.snapshot().profile) await model.load(); // after the sign-in of a guest
    await model.perform(action);
  });
  const leave = () => (canGoBack() ? router.back() : router.push("/"));

  return (
    <Screen
      header={
        <div className="flex items-center justify-between">
          <BackButton fallback="/" />
          <PersonMenu model={model} name={name} isFriend={profile?.friendship === "friends"} unfriend={() => model.perform("unfriend")} blocked={leave} />
        </div>
      }
    >
      {phase.kind === "notFound" ? (
        <p data-testid="person-not-found" className="pt-10 text-center font-title text-xl text-muted">
          این آدم پیدا نشد
        </p>
      ) : phase.kind === "failed" ? (
        <Note top="pt-10">{phase.message}</Note>
      ) : phase.kind === "loading" && status !== "guest" ? (
        <Busy />
      ) : (
        <div className="flex flex-col gap-[18px] pt-1.5">
          <div className="flex items-center gap-4">
            <FaceCircle parts={profile?.avatar ?? standardParts} size={104} padding={4} className="shadow-[0_4px_14px_rgba(20,17,43,0.18)]" />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <h1 data-testid="person-name" className="max-w-full truncate text-[28px] leading-[1.3] text-ink">
                {name}
              </h1>
              <p className="flex gap-1 text-[13px] text-muted">
                <span dir="ltr">@{username}</span>
                {profile && (
                  <>
                    <span>·</span>
                    <span data-testid="person-friends">{persianDigits(profile.friendsCount)} دوست</span>
                  </>
                )}
              </p>
              {profile?.league && (
                <p data-testid="person-league" className="mt-0.5 rounded-full bg-white px-2.5 py-[3px] text-xs font-bold text-ink">
                  {leagueName(profile.league.tier)}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2.5">
            {profile?.friendship === "friends" && (
              <span data-testid="person-friend-chip" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-track-light text-[15px] font-bold text-muted">
                {friendCopy.friends}
              </span>
            )}
            {buttonsOf(profile?.friendship ?? "none").map((action) => (
              <Button key={action} variant={isMain(action) ? "primary" : "ghost"} className="flex-1" disabled={isBusy} data-testid={`person-${action}`} onClick={() => ask(action, username)}>
                {titleOf(action)}
              </Button>
            ))}
          </div>
        </div>
      )}
      {sheet}
    </Screen>
  );
}
