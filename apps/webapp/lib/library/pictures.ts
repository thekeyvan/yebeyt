import { readJSON, Store, writeJSON, type KeyValueStorage } from "../reader/store";

/** One entry of `GET /v1/poets/pictures`. */
export type PoetPictureEntry = {
  slug: string;
  version: string;
  /** A path on the server, to be resolved against its address. */
  url: string;
};

/** Where the web app reaches the server: its own same-origin route, which passes the picture requests on (app/api). */
export const apiBase = "/api";

/** Two asks for the list are at least this many seconds apart. */
export const minimumGap = 60;

export const picturesKey = "poet.pictures";

const plain = (text: unknown): boolean => typeof text === "string" && /^[A-Za-z0-9_-]+$/.test(text);

/** Slug and version are plain words and the url is a path on our server: anything else is refused (`PoetPictureEntry.isSafe`). */
export const isSafe = (entry: unknown): entry is PoetPictureEntry => {
  const { slug, version, url } = (entry ?? {}) as Partial<PoetPictureEntry>;
  return plain(slug) && plain(version) && typeof url === "string" && url.startsWith("/") && !url.startsWith("//");
};

/** Where a picture is drawn from. */
export const pictureURL = ({ url }: PoetPictureEntry): string => `${apiBase}${url}`;

/**
 * The real pictures of the poets. The page has a default for each (the circle with a letter); the server's pictures replace it once the image
 * loads. The list is asked for at most once a minute and kept in localStorage, so what was shown shows again at once; a new version has a new
 * address, so the browser's own cache (the proxy passes the ETag and Cache-Control on) fetches it again (Library/PoetPictures.swift).
 */
export class PoetPictures extends Store<Readonly<Record<string, PoetPictureEntry>>> {
  private lastAsked?: number;

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init),
    private readonly now: () => number = Date.now,
  ) {
    const saved = readJSON(storage, picturesKey);
    super(Object.fromEntries((Array.isArray(saved) ? saved : []).filter(isSafe).map((entry) => [entry.slug, entry])));
  }

  /** Asks the server which poets have a picture, unless it was asked less than a minute ago. A failure keeps the list that was kept. */
  async refresh(): Promise<void> {
    if (this.lastAsked !== undefined && this.now() - this.lastAsked < minimumGap * 1000) return;
    this.lastAsked = this.now();
    try {
      const response = await this.fetcher(`${apiBase}/v1/poets/pictures`);
      if (!response.ok) return;
      const list = (await response.json()) as unknown;
      if (!Array.isArray(list)) return;
      const entries = list.filter(isSafe);
      writeJSON(this.storage, picturesKey, entries);
      this.set(Object.fromEntries(entries.map((entry) => [entry.slug, entry])));
    } catch {
      // No network, or an answer that is no list: what was kept stays.
    }
  }
}
