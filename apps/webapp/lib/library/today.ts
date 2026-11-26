import { devPagesEnabled } from "../dev";

/** A date key as the phone's launch argument writes it: `2026-11-23`. */
const dateKey = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Now, or the Tehran day a debug build has been told to be (`-beytToday` on the phone): the page reads `beytToday` from sessionStorage, only in a
 * development build or one made with NEXT_PUBLIC_DEV_PAGES=1. The day is a date key, taken at noon in Tehran.
 */
export function today(storage: Pick<Storage, "getItem"> = sessionStorage): Date {
  const key = devPagesEnabled() ? storage.getItem("beytToday") : null;
  return key !== null && dateKey.test(key) ? new Date(`${key}T12:00:00+03:30`) : new Date();
}
