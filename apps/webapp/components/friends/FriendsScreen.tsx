"use client";

import { useEffect, useMemo } from "react";
import type { Services } from "../../lib/account/services";
import { FriendsListModel } from "../../lib/friends/friendsList";
import { useStore } from "../../lib/library/browser";
import { useAccount } from "../account/AccountProvider";
import { ScreenHeader } from "../library/chrome";
import { WithServices } from "../me/WithServices";
import { Screen } from "../shell/Screen";
import { Busy, Note } from "./chrome";
import { PeopleCard, PersonRow } from "./PersonRow";
import { useEndOfList } from "./useEndOfList";

/** «دوستا»: my friends, with the same rows as the search (Friends/FriendsScreen.swift). */
export function FriendsScreen() {
  return <WithServices>{(services) => <Friends services={services} />}</WithServices>;
}

function Friends({ services }: { services: Services }) {
  const account = useAccount();
  const model = useMemo(() => new FriendsListModel(services.api), [services]);
  const { people, phase } = useStore(model)!;
  const { status } = useStore(services.session)!;
  const { friendsRevision } = useStore(services.friends)!;
  useStore(services.friends.blocked);
  const { blocked } = services.friends;
  const visible = blocked.visible(people, (one) => one.username);
  const last = visible.at(-1)?.username;
  const endRef = useEndOfList(last, () => void model.loadMore(blocked));

  // My friends are the account's: a guest gets the gate, and the list loads after the sign-in.
  useEffect(() => {
    account.require("messages", () => void model.load());
  }, [model, status === "in"]);
  useEffect(() => void model.reload(), [model, friendsRevision]);

  return (
    <Screen header={<ScreenHeader title="دوستا" fallback="/me" />}>
      <div className="flex flex-col gap-3.5 pt-1.5">
        {phase.kind === "loading" ? (
          <Busy />
        ) : phase.kind === "failed" ? (
          <Note>{phase.message}</Note>
        ) : visible.length === 0 ? (
          <Note testId="no-friends" top="pt-8">
            هنوز دوستی نداری. از «پیدا کردن دوست» شروع کن.
          </Note>
        ) : (
          <PeopleCard>
            {visible.map((person) => (
              <PersonRow key={person.username} person={person} />
            ))}
            <div ref={endRef} />
          </PeopleCard>
        )}
      </div>
    </Screen>
  );
}
