import type { KeyValueStorage } from "../lib/reader/store";

/** A storage that keeps what it is given in memory, as localStorage does in a browser (`seed` is what it starts with). */
export function memoryStorage(seed: Record<string, string> = {}): KeyValueStorage {
  const items = new Map(Object.entries(seed));
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value) };
}
