import { browserBundled } from "./bundled";
import { browserCache } from "./cache";
import { PoetryStore } from "./store";

let store: Promise<PoetryStore> | undefined;

/** The browser's store: the bundled files from /data, anything else from ganjoor-data, kept in Cache Storage. A failed open is tried again next time. */
export function poetryStore(): Promise<PoetryStore> {
  store ??= PoetryStore.open({ bundled: browserBundled(), cache: browserCache }).catch((error: unknown) => {
    store = undefined;
    throw error;
  });
  return store;
}
