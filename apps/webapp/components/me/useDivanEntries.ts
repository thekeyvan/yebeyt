"use client";

import { useEffect, useState } from "react";
import { DivanModel } from "../../lib/me/divanModel";
import type { DivanEntry } from "../../lib/me/divanLogic";
import { poetryStore } from "../../lib/poetry/browser";
import type { DivanItem } from "../../lib/reader/divan";

const model = new DivanModel(async (path) => (await poetryStore()).poem(path));

/** The couplets of `items` (the kept ones) with their text, loaded in the browser; asked again when the kept ones change. `loading` is true until the first answer. */
export function useDivanEntries(items: readonly DivanItem[]): { entries: DivanEntry[]; loading: boolean } {
  const [state, setState] = useState<{ entries: DivanEntry[]; loading: boolean }>({ entries: [], loading: true });
  const signature = items.map((item) => `${item.key}@${item.keptAt ?? 0}`).join("|");
  useEffect(() => {
    let current = true;
    void model.load(items).then((entries) => current && setState({ entries, loading: false }));
    return () => {
      current = false;
    };
    // `items` is a new list on every render; what it holds is named by the signature.
  }, [signature]);
  return state;
}
