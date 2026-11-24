import { z } from "zod";
import type { Deps } from "./deps.js";
import { ApiError } from "./errors.js";

export const POEM_CACHE_SIZE = 500;
export const FETCH_TIMEOUT_MS = 5000;

export type PoemCouplet = { m1: string; m2: string };

const verseSchema = z.object({ VOrder: z.number(), Position: z.string(), CoupletIndex: z.number().nullish(), Text: z.string() });
const poemSchema = z.object({ Verses: z.array(verseSchema) });

/** Verses on the second line of a couplet; every other position goes in the first. Editor notes (`Comment`) are not poetry. Same as tools/ganjoor/couplets.py. */
const SECOND_HALF = new Set(["Left", "CenteredVerse2"]);
const NOT_POETRY = "Comment";

/** Groups a poem's verses into couplets exactly as tools/ganjoor/couplets.py does, so an index here is the index on the phone. */
export function groupCouplets(verses: z.infer<typeof verseSchema>[]): PoemCouplet[] {
  const couplets: PoemCouplet[] = [];
  let index: number | null | undefined;
  let filled = new Set<string>();
  for (const v of [...verses].sort((a, b) => a.VOrder - b.VOrder)) {
    if (v.Position === NOT_POETRY) continue;
    const slot = SECOND_HALF.has(v.Position) ? "m2" : "m1";
    if (couplets.length === 0 || v.CoupletIndex !== index || filled.has(slot)) {
      couplets.push({ m1: "", m2: "" });
      index = v.CoupletIndex;
      filled = new Set();
    }
    couplets[couplets.length - 1]![slot] = v.Text.replaceAll("\r", "");
    filled.add(slot);
  }
  return couplets;
}

/**
 * The poems of ganjoor-data at the commit the app's data comes from (`poets.json` `source.sha`), fetched on demand from raw.githubusercontent.com
 * and kept in memory (the last 500, least recently used first out). Used to check the couplets players send in مشاعره.
 */
export function createGanjoor(deps: Pick<Deps, "fetch" | "data">) {
  const cache = new Map<string, Promise<PoemCouplet[] | null>>();

  async function load(poemPath: string): Promise<PoemCouplet[] | null> {
    const url = `https://raw.githubusercontent.com/ganjoor/ganjoor-data/${deps.data.sha}/poets${poemPath}.json`;
    let res: Response;
    try {
      res = await deps.fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch {
      throw new ApiError(503, "unavailable");
    }
    if (res.status === 404) return null;
    if (res.status !== 200) throw new ApiError(503, "unavailable");
    const parsed = poemSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new ApiError(503, "unavailable");
    return groupCouplets(parsed.data.Verses);
  }

  /** The couplets of a poem (`/hafez/ghazal/sh3`), null when there is no such poem; 503 `unavailable` when Ganjoor cannot be reached. */
  async function poem(poemPath: string): Promise<PoemCouplet[] | null> {
    if (poemPath.split("/").slice(1).some((part) => part === "")) return null;
    let pending = cache.get(poemPath);
    if (pending) {
      cache.delete(poemPath); // moves it to the end: most recently used
    } else {
      pending = load(poemPath);
      pending.catch(() => cache.delete(poemPath));
    }
    cache.set(poemPath, pending);
    if (cache.size > POEM_CACHE_SIZE) cache.delete(cache.keys().next().value!);
    return pending;
  }

  /** The couplet of a key "<poem>#<index>", or null when the poem or the index does not exist. */
  async function couplet(key: string): Promise<PoemCouplet | null> {
    const at = key.lastIndexOf("#");
    return (await poem(key.slice(0, at)))?.[Number(key.slice(at + 1))] ?? null;
  }

  return { poem, couplet };
}
