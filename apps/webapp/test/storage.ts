import type { RemovableStorage } from "../lib/reader/store";

/** A storage that keeps what it is given in memory, as localStorage does in a browser (`seed` is what it starts with). */
export function memoryStorage(seed: Record<string, string> = {}): RemovableStorage {
  const items = new Map(Object.entries(seed));
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value), removeItem: (key) => void items.delete(key) };
}
