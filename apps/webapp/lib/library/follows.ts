import { readJSON, Store, writeJSON, type KeyValueStorage } from "../reader/store";

/** What is kept in this browser until accounts sync it: the poets followed (دنبال کن) and the books bookmarked (Library/Follows.swift). */
export type FollowItem = { kind: "poet"; slug: string } | { kind: "book"; id: number };

export const followsKey = "library.follows";

const keyOf = (item: FollowItem): string => (item.kind === "poet" ? `poet:${item.slug}` : `book:${item.id}`);

/** Kept in localStorage as the phone keeps it: a sorted list of «poet:<slug>» and «book:<id>». */
export class Follows extends Store<ReadonlySet<string>> {
  constructor(private readonly storage: KeyValueStorage) {
    const saved = readJSON(storage, followsKey);
    super(new Set(Array.isArray(saved) ? saved.filter((key): key is string => typeof key === "string") : []));
  }

  contains = (item: FollowItem): boolean => this.snapshot().has(keyOf(item));

  /** Turns it on or off; returns whether it is on now. */
  toggle(item: FollowItem): boolean {
    const keys = new Set(this.snapshot());
    const on = !keys.delete(keyOf(item));
    if (on) keys.add(keyOf(item));
    writeJSON(this.storage, followsKey, [...keys].sort());
    this.set(keys);
    return on;
  }
}
