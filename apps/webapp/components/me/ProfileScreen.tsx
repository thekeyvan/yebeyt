"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { levelName } from "../../lib/me/badges";
import { favouritePoet } from "../../lib/me/favouritePoet";
import { persianDigits } from "../../lib/persian";
import { useLibraryData, useProgress, useStore } from "../../lib/library/browser";
import { spokenFace } from "../../lib/me/avatarCatalogue";
import { routeURL } from "../../lib/reader/route";
import { useMarks } from "../../lib/reader/browser";
import type { Services } from "../../lib/account/services";
import { useAccount } from "../account/AccountProvider";
import { useMyStats } from "../account/useMyStats";
import { RoundButton } from "../library/chrome";
import { Screen } from "../shell/Screen";
import { MeCard } from "./chrome";
import { BadgeTile } from "./BadgeSticker";
import { FaceCircle } from "./FaceCircle";
import { GearIcon, PencilIcon } from "./icons";
import { useAvatarParts } from "./useAvatarParts";
import { useBadges } from "./useBadges";
import { useDivanEntries } from "./useDivanEntries";
import { WithServices } from "./WithServices";

/** Me (Me/Profile/ProfileScreen.swift): the face, the name, the stats, the badges and the first couplets of the divan. */
export function ProfileScreen() {
  return <WithServices>{(services) => <Profile services={services} />}</WithServices>;
}

function Profile({ services }: { services: Services }) {
  const router = useRouter();
  const account = useAccount();
  return (
    <Screen
      header={
        <div className="flex items-center gap-2">
          <h1 className="flex-1 text-[34px] leading-[1.3] text-ink">من</h1>
          <button
            type="button"
            data-testid="invite-friends"
            onClick={() => account.require("invite", () => router.push("/me/invite"))}
            className="h-11 rounded-full bg-lapis px-3.5 text-[13px] font-bold text-white shadow-[0_3px_5px_rgba(47,53,245,0.28)]"
          >
            + دوستاتو بیار
          </button>
          <RoundButton label="تنظیمات" onClick={() => router.push("/me/settings")}>
            <GearIcon size={22} lineWidth={2.2} />
          </RoundButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Identity services={services} />
        <StatCards />
        <BadgesCard services={services} />
        <DivanPreview />
      </div>
    </Screen>
  );
}

function Identity({ services }: { services: Services }) {
  const account = useAccount();
  const { status, user } = useStore(services.session) ?? { status: "loading" };
  const parts = useAvatarParts(services);
  const marks = useMarks();
  const reading = useProgress();
  const { value: data } = useLibraryData();
  const signedIn = status === "in";
  const mine = useMyStats();
  // «۱۲ دوست» comes from my own public profile, once there is a username.
  useEffect(() => void services.myStats.refreshFriendsCount(), [services, user?.username, signedIn]);
  const name = status === "loading" ? "" : signedIn ? (user?.displayName ?? services.account.snapshot().providerName ?? user?.username ?? "من") : "مهمان";
  const slug = favouritePoet([...marks.keys("kept")], reading.finishedPaths);
  const poet = slug && data?.library.poet(slug)?.name;
  return (
    <div className="flex items-center gap-4">
      <Link href="/me/avatar" aria-label="ویرایش چهره" data-testid="edit-avatar" className="relative size-[104px] shrink-0">
        <FaceCircle parts={parts} size={104} padding={4} className="shadow-[0_4px_14px_rgba(20,17,43,0.18)]" />
        <span className="absolute end-0 bottom-0 grid size-8 place-items-center rounded-full border-[3px] border-white bg-lapis text-white">
          <PencilIcon size={14} lineWidth={2.6} />
        </span>
        <span className="sr-only">{spokenFace(parts)}</span>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <p data-testid="profile-name" className="min-h-[36px] max-w-full truncate font-title text-[28px] leading-[1.3] text-ink">
          {name}
        </p>
        {signedIn && user?.username && (
          <p className="flex gap-1 text-[13px] text-muted">
            <span data-testid="profile-username" dir="ltr">
              @{user.username}
            </span>
            {mine.friendsCount !== undefined && (
              <>
                <span>·</span>
                <Link href="/me/friends" data-testid="profile-friends">
                  {persianDigits(mine.friendsCount)} دوست
                </Link>
              </>
            )}
          </p>
        )}
        {!signedIn && status !== "loading" && (
          <button type="button" data-testid="profile-sign-in" onClick={() => account.require("profile")} className="rounded-full bg-lapis px-[18px] py-[5px] text-[13px] font-bold text-white">
            ورود
          </button>
        )}
        {poet && (
          <p data-testid="favourite-poet" className="mt-0.5 rounded-full bg-white px-2.5 py-[3px] text-xs font-bold text-ink">
            شاعرِ محبوب: {poet}
          </p>
        )}
      </div>
    </div>
  );
}

function StatCards() {
  const mine = useMyStats();
  const card = (value: string, label: string, look: string, testId: string) => (
    <div data-testid={testId} className={`flex flex-1 flex-col items-center rounded-[20px] border-4 border-white px-1 py-2.5 shadow-card ${look}`}>
      <span className="max-w-full truncate font-title text-xl leading-[1.3]">{value}</span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
  return (
    <div className="flex gap-2.5">
      {card(levelName(mine.points), "سطح", "bg-lapis text-white", "stat-level")}
      {card(persianDigits(mine.points, { grouped: true }), "امتیاز", "bg-amber text-ink", "stat-points")}
      {card(`${persianDigits(mine.streak)} روز`, "پشت‌سرهم", "bg-fire text-white", "stat-streak")}
    </div>
  );
}

function BadgesCard({ services }: { services: Services }) {
  const badges = useBadges(services);
  return (
    <MeCard className="px-3 pt-3.5 pb-3">
      <div className="flex items-center px-1 pb-2.5">
        <h2 className="flex-1 font-ui text-[15px] font-bold text-ink">نشان‌ها</h2>
        <Link href="/me/badges" data-testid="all-badges" className="text-[13px] font-bold text-lapis">
          همه
        </Link>
      </div>
      <ul className="flex gap-1.5">
        {badges.map((badge) => (
          <BadgeTile key={badge.id} badge={badge} />
        ))}
      </ul>
    </MeCard>
  );
}

const emptyDivan = "هنوز بیتی نگه نداشتی. توی شعرها «نگه دار» رو بزن.";

function DivanPreview() {
  const marks = useMarks();
  const kept = marks.keptItems();
  const { entries } = useDivanEntries(kept.slice(0, 2));
  const { value: data } = useLibraryData();
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center">
        <h2 className="flex-1 font-ui text-[15px] font-bold text-ink">
          <Link href="/me/divan" data-testid="open-divan-title">
            دیوانِ من
          </Link>
        </h2>
        {kept.length > 0 && (
          <Link href="/me/divan" data-testid="open-divan" className="text-[13px] font-bold text-lapis">
            همه‌ی {persianDigits(kept.length)} بیت
          </Link>
        )}
      </div>
      {kept.length === 0 ? (
        <MeCard className="rounded-[18px] p-3.5 text-[13px] leading-[1.9] text-muted">{emptyDivan}</MeCard>
      ) : (
        <div className="flex gap-2.5">
          {entries.map((entry) => (
            <Link
              key={entry.key}
              href={routeURL(entry.path, entry.index, "couplet")}
              data-testid={`profile-couplet-${entry.key}`}
              className="flex h-[128px] min-w-0 flex-1 flex-col justify-between rounded-[18px] bg-white p-3 text-ink shadow-[0_3px_6px_rgba(20,17,43,0.08)]"
            >
              <span className="line-clamp-2 font-poem text-[15px] leading-[1.9]">{entry.couplet.m1}</span>
              <span className="text-[11px] text-muted">{data?.library.poet(entry.poetSlug)?.name ?? ""}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
