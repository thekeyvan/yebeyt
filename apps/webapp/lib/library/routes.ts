import type { LibraryBook } from "./models";

// The addresses of the library screens, next to the phone's debug routes (`-beytRoute library|book:<path>|section:<path>|poet:<slug>|search:<query>|mood:<key>|poets`).

export const libraryHref = "/explore/library";
export const poetsHref = "/explore/poets";
export const searchHref = (query = ""): string => (query === "" ? "/explore/search" : `/explore/search?q=${encodeURIComponent(query)}`);
export const moodHref = (key: string): string => `/explore/mood/${encodeURIComponent(key)}`;
export const poetHref = (slug: string): string => `/explore/poet/${encodeURIComponent(slug)}`;

/** A book by its Ganjoor path (`/hafez` → `/explore/book/hafez`). */
export const bookHref = ({ path }: Pick<LibraryBook, "path">): string => `/explore/book${path}`;

/** A section by its Ganjoor path (`/hafez/ghazal` → `/explore/section/hafez/ghazal`). */
export const sectionHref = (path: string): string => `/explore/section${path}`;

/** The Ganjoor path an address's segments (as Next gives them, decoded) stand for. */
export const ganjoorPath = (segments: string[]): string => `/${segments.join("/")}`;
