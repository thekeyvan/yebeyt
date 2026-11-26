import { readJSON, writeJSON, type RemovableStorage } from "../reader/store";

/**
 * A list kept in storage and nowhere else: every read asks the storage and every change writes it at once, so two tabs of the same browser, which share
 * localStorage, see each other's changes and none overwrites another's with a copy of its own (the unsent reactions and scores).
 */
export class StoredList<T> {
  constructor(
    private readonly storage: RemovableStorage,
    private readonly key: string,
  ) {}

  get items(): T[] {
    const saved = readJSON(this.storage, this.key);
    return Array.isArray(saved) ? (saved as T[]) : [];
  }

  set items(list: T[]) {
    writeJSON(this.storage, this.key, list);
  }

  clear(): void {
    this.storage.removeItem(this.key);
  }
}
