"use client";

import { useEffect, useState } from "react";
import type { ResolvedCouplet } from "../../lib/messages/resolver";
import { useLoaded } from "../../lib/library/browser";
import { poetryStore } from "../../lib/poetry/browser";
import { useServices } from "../account/useServices";

/** The couplet a key names (its text comes from the poem, bundled or fetched): undefined while it is read, null when the poem can't be loaded. */
export function useCouplet(key: string | null): ResolvedCouplet | null | undefined {
  const resolver = useServices()?.resolver;
  const [found, setFound] = useState<{ key: string; couplet: ResolvedCouplet | null }>();
  useEffect(() => {
    if (!resolver || key === null) return;
    let current = true;
    void resolver.resolve(key).then((couplet) => current && setFound({ key, couplet: couplet ?? null }));
    return () => {
      current = false;
    };
  }, [resolver, key]);
  return key === null ? null : found?.key === key ? found.couplet : undefined;
}

/** The short name of a poet by slug («حافظ»), the slug itself until the poets have loaded. */
export function usePoetName(): (slug: string) => string {
  const { value: store } = useLoaded(poetryStore);
  return (slug) => store?.poets.find((poet) => poet.slug === slug)?.nickname ?? slug;
}
