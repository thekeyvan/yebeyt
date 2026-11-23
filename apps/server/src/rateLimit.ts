/**
 * A fixed-window counter kept in memory, keyed by user id (or any label). Nothing is persisted.
 * `take` counts a call at once. For a budget that must only be spent on success, ask `fits` first and call `spend` afterwards.
 */
export function createRateLimiter(limit: number, windowMs: number, now: () => Date) {
  const windows = new Map<string, { resetAt: number; count: number }>();
  const live = (key: string) => {
    const w = windows.get(key);
    return w && w.resetAt > now().getTime() ? w : undefined;
  };
  const spend = (key: string, cost: number) => {
    const t = now().getTime();
    if (windows.size > 10_000) {
      for (const [k, w] of windows) if (w.resetAt <= t) windows.delete(k);
    }
    const w = live(key);
    if (w) w.count += cost;
    else windows.set(key, { resetAt: t + windowMs, count: cost });
  };
  return {
    /** Returns true when the call is allowed. */
    take(key: string): boolean {
      spend(key, 1);
      return live(key)!.count <= limit;
    },
    /** True when `cost` more would still be within the limit. Counts nothing. */
    fits(key: string, cost: number): boolean {
      return (live(key)?.count ?? 0) + cost <= limit;
    },
    spend,
  };
}
