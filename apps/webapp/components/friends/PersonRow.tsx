"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { FriendAction } from "../../lib/friends/friendship";
import { nameOf, type FoundPerson, type PersonShort } from "../../lib/friends/models";
import { FacePerson } from "./FacePerson";
import { FriendControl } from "./FriendControl";

/** A person's face, name and @username; the row opens their page (Friends/FriendParts.swift `PersonIdentity`). */
export function PersonIdentity({ person, testId }: { person: PersonShort; testId?: string }) {
  return (
    <Link href={`/u/${person.username}`} data-testid={testId} className="flex min-w-0 flex-1 items-center gap-3">
      <FacePerson parts={person.avatar} size={48} />
      <span className="flex min-w-0 flex-col items-start">
        <span className="max-w-full truncate text-[15px] font-bold text-ink">{nameOf(person)}</span>
        <span dir="ltr" className="max-w-full truncate text-xs text-muted">
          @{person.username}
        </span>
      </span>
    </Link>
  );
}

/** A person in a list (search, friends): face, name, @username and what the friendship offers; the list of my friends offers nothing but the chip «دوستین» (no `act`). */
export function PersonRow({ person, busy, act = () => {} }: { person: FoundPerson; busy?: boolean; act?: (action: FriendAction) => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <PersonIdentity person={person} testId={`person-${person.username}`} />
      <FriendControl username={person.username} friendship={person.friendship} busy={busy} act={act} />
    </div>
  );
}

/** The white card the rows of people sit in. */
export function PeopleCard({ children }: { children: ReactNode }) {
  return <div className="w-full rounded-3xl bg-white py-1.5 shadow-[0_6px_11px_rgba(20,17,43,0.08)]">{children}</div>;
}
