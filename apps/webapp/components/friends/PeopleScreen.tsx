"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../../lib/library/browser";
import type { Services } from "../../lib/account/services";
import { PeopleSearchModel } from "../../lib/friends/search";
import { toast } from "../ui/Toast";
import { useAccount } from "../account/AccountProvider";
import { ScreenHeader, SearchBox } from "../library/chrome";
import { NothingFound } from "../library/rows";
import { Screen } from "../shell/Screen";
import { WithServices } from "../me/WithServices";
import { Busy, Note } from "./chrome";
import { PeopleCard, PersonRow } from "./PersonRow";
import { useFriendAsk } from "./useFriendAsk";

/** «پیدا کردن دوست»: a field for a username and the people found, each with the button of its friendship (Friends/PeopleScreen.swift). `initial` is what the field starts with (`?q=`). */
export function PeopleScreen({ initial }: { initial: string }) {
  return <WithServices>{(services) => <People services={services} initial={initial} />}</WithServices>;
}

function People({ services, initial }: { services: Services; initial: string }) {
  const account = useAccount();
  const model = useMemo(() => new PeopleSearchModel(services.api, services.friends), [services]);
  const { people, pending, phase } = useStore(model)!;
  useStore(services.session);
  useStore(services.friends.blocked);
  const [text, setText] = useState(initial);
  const visible = services.friends.blocked.visible(people, (one) => one.username);
  const { ask, sheet } = useFriendAsk(async (action, username) => {
    const line = await model.perform(action, username);
    if (line) toast(line);
  });

  // The search is a use of the account: a guest gets the gate, and the search goes ahead after the sign-in (with the text as it is then). Typing before the
  // sign-in is known keeps only the first waiting action, which is why it asks for the text when it runs.
  const latest = useRef(initial);
  const search = (value: string) => {
    latest.current = value;
    account.require("messages", () => model.queryChanged(latest.current));
  };
  useEffect(() => {
    if (initial) search(initial);
    // Only the first opening starts with text.
  }, []);

  return (
    <Screen header={<ScreenHeader title="پیدا کردن دوست" fallback="/" />}>
      <div className="flex flex-col gap-3.5 pt-1.5">
        <SearchBox
          round
          autoFocus
          value={text}
          onChange={(value) => {
            setText(value);
            search(value);
          }}
          placeholder="نام کاربری…"
        />
        {phase.kind === "failed" ? (
          <Note>{phase.message}</Note>
        ) : phase.kind === "loading" && visible.length === 0 ? (
          <Busy />
        ) : phase.kind === "loaded" && visible.length === 0 ? (
          <NothingFound />
        ) : (
          visible.length > 0 && (
            <PeopleCard>
              {visible.map((person) => (
                <PersonRow key={person.username} person={person} busy={pending.has(person.username)} act={(action) => ask(action, person.username)} />
              ))}
            </PeopleCard>
          )
        )}
      </div>
      {sheet}
    </Screen>
  );
}
