/** The reader's synced state, same shape as Prefs.SyncState in the app. */
export interface SyncState {
  saved?: string[];
  savedAt?: Record<string, number>;
  unsavedAt?: Record<string, number>;
  seen?: string[];
  days?: string[];
  recent?: { url: string; couplet: number }[];
  reciter?: Record<string, number>;
  vibes?: string[];
}

const maxMerge = (a: Record<string, number> = {}, b: Record<string, number> = {}) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
};

const union = <T>(a: T[] = [], b: T[] = []) => [...a, ...b.filter((x) => !a.includes(x))];

/** Combines two accounts' state (used when merging accounts). Mirrors Prefs.merge in the app. */
export function mergeStates(a: SyncState, b: SyncState): SyncState {
  const savedAt = maxMerge(a.savedAt, b.savedAt);
  const unsavedAt = maxMerge(a.unsavedAt, b.unsavedAt);
  const keys = union(a.saved, b.saved);
  for (const k of keys) savedAt[k] ??= 1;
  const saved = keys.filter((k) => (savedAt[k] ?? 0) > (unsavedAt[k] ?? 0)).sort((x, y) => (savedAt[y] ?? 0) - (savedAt[x] ?? 0));
  const recent: { url: string; couplet: number }[] = [];
  for (const r of [...(a.recent ?? []), ...(b.recent ?? [])]) if (!recent.some((x) => x.url === r.url)) recent.push(r);
  return {
    saved,
    savedAt,
    unsavedAt,
    seen: union(a.seen, b.seen),
    days: union(a.days, b.days).sort().slice(-400),
    recent: recent.slice(0, 12),
    reciter: { ...(b.reciter ?? {}), ...(a.reciter ?? {}) },
    vibes: union(a.vibes, b.vibes),
  };
}
