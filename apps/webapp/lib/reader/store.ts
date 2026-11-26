/** The smallest store React can follow with `useSyncExternalStore`: an immutable state, replaced on every change. */
export class Store<T> {
  private listeners = new Set<() => void>();

  constructor(private current: T) {}

  /** What a component reads; a new object after every change. */
  readonly snapshot = (): T => this.current;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  protected set(next: T): void {
    this.current = next;
    for (const listener of this.listeners) listener();
  }
}

/** The part of `Storage` the stores use: what they keep, and where (localStorage in the browser). */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

/** Parsed JSON saved under `key`; `undefined` when there is none or it is unreadable. */
export function readJSON(storage: KeyValueStorage, key: string): unknown {
  try {
    const text = storage.getItem(key);
    return text === null ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Saves `value` as JSON; best effort (a full or blocked storage keeps nothing, and the app goes on). */
export function writeJSON(storage: KeyValueStorage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Not kept: the next launch starts from what was kept before.
  }
}
