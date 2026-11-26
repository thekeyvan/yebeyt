import { devPagesEnabled } from "../dev";
import { TehranDay } from "./tehranDay";

const noon = 12 * 3600 * 1000;

/**
 * Now, or the Tehran day a debug build has been told to be (`-beytToday` on the phone): the page reads `beytToday` from sessionStorage, only in a development
 * build or one made with NEXT_PUBLIC_DEV_PAGES=1. The day is that date key in Tehran, taken at noon there, whatever the device's own clock and zone.
 */
export function tehranNow(storage: Pick<Storage, "getItem"> = sessionStorage): Date {
  const key = devPagesEnabled() ? storage.getItem("beytToday") : null;
  const day = key === null ? undefined : TehranDay.fromKey(key);
  return day ? new Date(day.start.getTime() + noon) : new Date();
}

/** The seed a debug build was given (`sessionStorage.beytSeed = "7"`), so a جورچین round is the same every time; none in a release build or for anything but digits. */
export function roundSeed(storage: Pick<Storage, "getItem"> = sessionStorage): bigint | undefined {
  const seed = devPagesEnabled() ? storage.getItem("beytSeed") : null;
  return seed !== null && /^\d{1,18}$/.test(seed) ? BigInt(seed) : undefined;
}
