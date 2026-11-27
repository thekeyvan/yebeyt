"use client";

import { useMemo, useState } from "react";
import type { Services } from "../../lib/account/services";
import { feedbackPrivate } from "../../lib/feedbackPrivate";
import { PeopleSearchModel } from "../../lib/friends/search";
import { nameOf, type FoundPerson } from "../../lib/friends/models";
import { useStore } from "../../lib/library/browser";
import { SearchBox } from "../library/chrome";
import { NothingFound } from "../library/rows";
import { Sheet } from "../ui/Sheet";
import { toast } from "../ui/Toast";
import { FacePerson } from "./FacePerson";
import { Busy, Note } from "./chrome";

type Props = {
  services: Services;
  open: boolean;
  onClose: () => void;
  title: string;
  /** What a tap does: the line to show when it failed; undefined closes the sheet. */
  choose: (person: FoundPerson) => Promise<string | undefined>;
  /** Leaves out who can't play («یه بیت»): for an invitation to a game. */
  invite?: boolean;
  /** The prefix of the rows' test ids: `<prefix>-<username>`. */
  testPrefix?: string;
};

/**
 * The people search of «پیدا کردن دوست» in a mode for choosing someone, as a sheet: «پیام تازه» opens the chat with them, the game lobby and the challenge card add them
 * to the people to invite (Friends/PeoplePickSheet.swift).
 */
export function PeoplePickSheet({ services, open, onClose, title, choose, invite = false, testPrefix = "pick" }: Props) {
  const model = useMemo(() => new PeopleSearchModel(services.api, services.friends), [services]);
  const { people, phase } = useStore(model)!;
  const [text, setText] = useState("");
  const visible = services.friends.blocked.visible(people, (one) => one.username).filter((person) => !invite || person.canPlay !== false);

  async function pick(person: FoundPerson) {
    const line = await choose(person);
    if (line === undefined) onClose();
    else toast(line);
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()} title={title}>
      <div className="flex min-h-[40dvh] w-full flex-col gap-3">
        <div {...feedbackPrivate}>
          <SearchBox
            round
            autoFocus
            value={text}
            onChange={(value) => {
              setText(value);
              model.queryChanged(value);
            }}
            placeholder="نام کاربری…"
          />
        </div>
        {phase.kind === "failed" ? (
          <Note>{phase.message}</Note>
        ) : phase.kind === "loading" && visible.length === 0 ? (
          <Busy />
        ) : phase.kind === "loaded" && visible.length === 0 ? (
          <NothingFound />
        ) : (
          visible.map((person) => (
            <button key={person.username} type="button" data-testid={`${testPrefix}-${person.username}`} onClick={() => void pick(person)} className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-2 text-start shadow-[0_2px_5px_rgba(20,17,43,0.06)]">
              <FacePerson parts={person.avatar} size={44} />
              <span className="flex min-w-0 flex-col items-start">
                <span className="max-w-full truncate text-[15px] font-bold text-ink">{nameOf(person)}</span>
                <span dir="ltr" className="max-w-full truncate text-xs text-muted">
                  @{person.username}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </Sheet>
  );
}
