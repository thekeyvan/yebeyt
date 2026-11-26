"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Services } from "../../lib/account/services";
import { FeedModel } from "../../lib/friends/feed";
import { useStore } from "../../lib/library/browser";
import { useServices } from "../account/useServices";
import { FeedCard } from "./FeedCard";
import { useEndOfList } from "./useEndOfList";

/** «دوستات» on the home tab (Calm): the heading with «پیدا کردن دوست», then what friends did, newest first. A guest sees nothing (Friends/Feed/FeedSection.swift). */
export function FriendsFeedSection() {
  const services = useServices();
  const status = useStore(services?.session)?.status;
  return services && status === "in" ? <Feed services={services} /> : null;
}

function Feed({ services }: { services: Services }) {
  const model = useMemo(() => new FeedModel(services.session, services.api), [services]);
  const { entries, counts } = useStore(model)!;
  useStore(services.friends.blocked);
  const { blocked } = services.friends;
  const [now, setNow] = useState(() => new Date());
  const visible = blocked.visible(entries, (entry) => entry.item.user.username);
  // The list is lazy: the next page is asked for when the end comes into view. Someone at the end of what was loaded was blocked: no row at the end will come, so the end is still in view.
  const end = useEndOfList(visible.at(-1)?.id ?? "", () => void model.loadMore(blocked));

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      setNow(new Date());
      void model.refresh();
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [model]);

  return (
    <section aria-label="دوستات" data-testid="friends-feed" className="flex flex-col gap-2.5 pt-1">
      <div className="flex items-center pt-1">
        <h2 className="flex-1 text-2xl leading-[1.3] text-ink">دوستات</h2>
        <Link href="/people" data-testid="find-people" className="text-sm font-medium text-lapis">
          پیدا کردن دوست
        </Link>
      </div>
      {visible.map((entry) => (
        <FeedCard key={entry.id} item={entry.item} counts={entry.item.key ? counts[entry.item.key] : undefined} now={now} />
      ))}
      <div ref={end} />
    </section>
  );
}
