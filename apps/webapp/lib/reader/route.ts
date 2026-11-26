/** How the reader shows the poem: one couplet at a time, or all of it. */
export type ReaderMode = "couplet" | "scroll";

/** Where the reader opens: a poem by Ganjoor path, and the state it starts in (Reader/ReaderRoute.swift). */
export type ReaderRoute = {
  path: string;
  /** 0-based. */
  couplet: number;
  mode: ReaderMode;
  /** The meaning card starts open. */
  meaning: boolean;
};

type Query = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** `/poem/hafez/ghazal/sh3?c=2&mode=scroll&meaning=1` → the route; what is missing or unreadable is the start of the poem, in couplet mode, no meaning. */
export function parseRoute(segments: string[], query: Query): ReaderRoute {
  const couplet = Number(first(query.c));
  return {
    path: `/${segments.map(decode).join("/")}`,
    couplet: Number.isInteger(couplet) && couplet > 0 ? couplet : 0,
    mode: first(query.mode) === "scroll" ? "scroll" : "couplet",
    meaning: first(query.meaning) === "1",
  };
}

/** The address of the reader at a couplet in a mode: what the address bar keeps, so a link reopens the same couplet. */
export function routeURL(path: string, couplet: number, mode: ReaderMode): string {
  return `/poem${path}?c=${couplet}${mode === "scroll" ? "&mode=scroll" : ""}`;
}
