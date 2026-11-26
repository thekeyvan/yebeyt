"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import type { Services } from "../../lib/account/services";
import { friendCopy, titleOf } from "../../lib/friends/friendship";
import type { FriendRequest } from "../../lib/friends/models";
import { bouncy, rowArrival, useVariant } from "../../lib/motion";
import { useStore } from "../../lib/library/browser";
import { useAccount } from "../account/AccountProvider";
import { ScreenHeader } from "../library/chrome";
import { WithServices } from "../me/WithServices";
import { Screen } from "../shell/Screen";
import { toast } from "../ui/Toast";
import { Busy, Note } from "./chrome";
import { FriendButton } from "./FriendControl";
import { PeopleCard, PersonIdentity } from "./PersonRow";
import { useFriendAsk } from "./useFriendAsk";

/**
 * «درخواست‌های دوستی»: the requests I got, each with «قبول» and «رد», and under them «فرستادی»: the ones I sent, each with «لغو». Accepting moves the person to my
 * friends; rejecting just removes the row (they are not told) (Friends/RequestsScreen.swift).
 */
export function RequestsScreen() {
  return <WithServices>{(services) => <Requests services={services} />}</WithServices>;
}

/** A request: the person (opens their page) and the buttons at the end; it scales in and out as rows come and go (`Motion.row`). */
function RequestRow({ request, children }: { request: FriendRequest; children: ReactNode }) {
  const arrival = rowArrival(useVariant());
  return (
    <motion.div layout="position" initial={arrival} animate={{ opacity: 1, scale: 1, y: 0 }} exit={arrival} transition={bouncy} data-testid={`request-row-${request.username}`} className="flex items-center gap-3 px-4 py-2">
      <PersonIdentity person={request} testId={`request-${request.username}`} />
      {children}
    </motion.div>
  );
}

function Requests({ services }: { services: Services }) {
  const account = useAccount();
  const { requests } = services.friends;
  const { incoming, outgoing, phase, pending } = useStore(requests)!;
  const { status } = useStore(services.session)!;
  const { ask, sheet } = useFriendAsk(async (action, username) => {
    const line = await requests.perform(action, username);
    if (line) toast(line);
  });

  // The lists are the account's: a guest gets the gate, and they load after the sign-in.
  useEffect(() => {
    account.require("messages", () => void requests.load());
  }, [status === "in"]);

  return (
    <Screen header={<ScreenHeader title={friendCopy.requestsTitle} fallback="/messages" />}>
      <div className="flex flex-col gap-3.5 pt-1.5">
        {phase.kind === "loading" ? (
          <Busy />
        ) : phase.kind === "failed" ? (
          <Note>{phase.message}</Note>
        ) : (
          <>
            {incoming.length === 0 && outgoing.length === 0 && (
              <Note testId="no-requests" top="pt-8">
                {friendCopy.noRequests}
              </Note>
            )}
            {incoming.length > 0 && (
              <PeopleCard>
                <AnimatePresence initial={false}>
                  {incoming.map((request) => (
                    <RequestRow key={request.username} request={request}>
                      <div className="flex shrink-0 gap-2">
                        {(["accept", "reject"] as const).map((action) => (
                          <FriendButton key={action} title={titleOf(action)} quiet={action === "reject"} busy={pending.has(request.username)} onPress={() => ask(action, request.username)} testId={`${action}-${request.username}`} />
                        ))}
                      </div>
                    </RequestRow>
                  ))}
                </AnimatePresence>
              </PeopleCard>
            )}
            {outgoing.length > 0 && (
              <>
                <h2 className="pt-2 text-[22px] leading-[1.3] text-ink">{friendCopy.sentSection}</h2>
                <PeopleCard>
                  <AnimatePresence initial={false}>
                    {outgoing.map((request) => (
                      <RequestRow key={request.username} request={request}>
                        <FriendButton title={friendCopy.cancelSent} quiet busy={pending.has(request.username)} onPress={() => ask("cancel", request.username)} testId={`cancel-${request.username}`} />
                      </RequestRow>
                    ))}
                  </AnimatePresence>
                </PeopleCard>
              </>
            )}
          </>
        )}
      </div>
      {sheet}
    </Screen>
  );
}
