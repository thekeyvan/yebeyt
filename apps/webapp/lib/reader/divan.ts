// The divan as the phone and the server both know it (Me/Divan/DivanItem.swift): when a couplet was kept and when it was
// taken out, in milliseconds since 1970. W4 syncs these with the server, which writes the times as ISO strings.

/** One couplet of the divan. `key` is `coupletKey` (the poem path and the 0-based couplet index). */
export type DivanItem = { key: string; keptAt?: number; removedAt?: number };

/** Kept when `keptAt` is after `removedAt`; a removed couplet stays as a record, so a removal reaches the other devices too. */
export const isKept = ({ keptAt, removedAt }: DivanItem): boolean => keptAt !== undefined && (removedAt === undefined || keptAt > removedAt);

const later = (a?: number, b?: number): number | undefined => (a === undefined ? b : b === undefined ? a : Math.max(a, b));

/** The server's rule: the later of each time wins, so the last change per couplet wins. */
export const merged = (a: DivanItem, b: DivanItem): DivanItem => ({ key: a.key, keptAt: later(a.keptAt, b.keptAt), removedAt: later(a.removedAt, b.removedAt) });

/** «2023-11-14T22:13:20.123Z»: the wire format of the contract. */
const timeString = (milliseconds: number): string => new Date(milliseconds).toISOString();

/** The saved form of an item: times as ISO strings, as on the phone. */
export const toWire = ({ key, keptAt, removedAt }: DivanItem) => ({
  key,
  ...(keptAt === undefined ? {} : { keptAt: timeString(keptAt) }),
  ...(removedAt === undefined ? {} : { removedAt: timeString(removedAt) }),
});

const time = (value: unknown): number | undefined => {
  const milliseconds = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isNaN(milliseconds) ? undefined : milliseconds;
};

/** An item from its saved form; undefined for anything that is not one. */
export function fromWire(value: unknown): DivanItem | undefined {
  if (typeof value !== "object" || value === null || typeof (value as { key?: unknown }).key !== "string") return undefined;
  const { key, keptAt, removedAt } = value as { key: string; keptAt?: unknown; removedAt?: unknown };
  return { key, keptAt: time(keptAt), removedAt: time(removedAt) };
}
