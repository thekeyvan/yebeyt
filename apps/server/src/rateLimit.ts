/** A fixed-window counter kept in memory, keyed by user id (or any label). Nothing is persisted. `cost` lets it count bytes as well as calls. */
export function createRateLimiter(limit: number, windowMs: number, now: () => Date) {
  const windows = new Map<string, { resetAt: number; count: number }>();
  return {
    /** Returns true when the call is allowed. */
    take(key: string, cost = 1): boolean {
      const t = now().getTime();
      if (windows.size > 10_000) {
        for (const [k, w] of windows) if (w.resetAt <= t) windows.delete(k);
      }
      const w = windows.get(key);
      if (!w || w.resetAt <= t) {
        windows.set(key, { resetAt: t + windowMs, count: cost });
        return cost <= limit;
      }
      w.count += cost;
      return w.count <= limit;
    },
  };
}
