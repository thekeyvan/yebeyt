import type { PoetryCache } from "./store";

const prefix = "poetry-";

/**
 * Cache Storage, one cache for each ganjoor-data commit (`poetry-<sha>`; the caches of other commits are dropped), so a book or
 * poem opened once works offline (Poetry/PoetryCache.swift). Best effort: where there is no Cache Storage (an insecure page,
 * a private window) or it fails, every read is a miss and every write does nothing.
 */
export function browserCache(sha: string): PoetryCache {
  const opened = (async () => {
    for (const name of await caches.keys()) if (name.startsWith(prefix) && name !== prefix + sha) await caches.delete(name);
    return caches.open(prefix + sha);
  })();
  opened.catch(() => {});
  const url = (key: string) => `/_poetry/${key}`;
  return {
    async read<T>(key: string) {
      try {
        const hit = await (await opened).match(url(key));
        return hit ? ((await hit.json()) as T) : undefined;
      } catch {
        return undefined;
      }
    },
    async write(key, value) {
      try {
        await (await opened).put(url(key), new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } }));
      } catch {
        // Not cached: the next open fetches it again.
      }
    },
  };
}
