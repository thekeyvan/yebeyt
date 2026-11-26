import { coupletKey } from "../reader/marks";
import { readJSON, Store, writeJSON, type KeyValueStorage } from "../reader/store";

/** Where the reader was left in a poem, for the «ادامه» cards. */
export type Last = {
  path: string;
  /** The 0-based couplet it was left at. */
  couplet: number;
  /** «غزل ۳» */
  title: string;
};

type State = { last?: Last; finished: ReadonlySet<string>; couplets: ReadonlySet<string> };

/** Where the progress is kept in localStorage: the same name and JSON as the phone's UserDefaults. */
export const progressKey = "reader.progress";

const strings = (value: unknown): Set<string> => new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

function load(storage: KeyValueStorage): State {
  const saved = readJSON(storage, progressKey) as { last?: Partial<Last>; finished?: unknown; couplets?: unknown } | undefined;
  const { last } = saved ?? {};
  const valid = typeof last?.path === "string" && typeof last.couplet === "number" && typeof last.title === "string";
  return { last: valid ? (last as Last) : undefined, finished: strings(saved?.finished), couplets: strings(saved?.couplets) };
}

/**
 * What has been read in this browser (Library/ReadingProgress.swift): the poem opened last (with its couplet) and the poems finished. A poem
 * is read («خوندی») once the reader reached its last couplet, in couplet mode, or the end of the whole poem. «داری می‌خونی» is the poem
 * opened last, when it is not finished. Kept as the same JSON as the phone, ready for sync.
 */
export class ReadingProgress extends Store<State> {
  constructor(private readonly storage: KeyValueStorage) {
    super(load(storage));
  }

  get last(): Last | undefined {
    return this.snapshot().last;
  }

  /** The reader is on this couplet of a poem with `count` couplets; its last couplet finishes the poem. */
  opened(path: string, couplet: number, count: number, title: string): void {
    const { finished, couplets } = this.snapshot();
    this.save({
      last: { path, couplet, title },
      finished: couplet >= count - 1 ? new Set(finished).add(path) : finished,
      couplets: new Set(couplets).add(coupletKey(path, couplet)),
    });
  }

  /** The whole-poem list was scrolled to its end: all `count` couplets of the poem were passed. */
  reachedEnd(path: string, count = 0): void {
    const { last, finished, couplets } = this.snapshot();
    const passed = new Set(couplets);
    for (let couplet = 0; couplet < count; couplet++) passed.add(coupletKey(path, couplet));
    this.save({ last, finished: new Set(finished).add(path), couplets: passed });
  }

  /** How many different couplets have been read (the «۱۰۰ بیت» badge). */
  get coupletsRead(): number {
    return this.snapshot().couplets.size;
  }

  /** The paths of the poems read to the end. */
  get finishedPaths(): string[] {
    return [...this.snapshot().finished];
  }

  isRead = (path: string): boolean => this.snapshot().finished.has(path);

  /** The poem opened last, when it is not finished. */
  isInProgress = (path: string): boolean => this.snapshot().last?.path === path && !this.isRead(path);

  /** How many of these poems are read. */
  readCount = (paths: Iterable<string>): number => [...paths].filter(this.isRead).length;

  private save(next: State): void {
    writeJSON(this.storage, progressKey, { ...(next.last && { last: next.last }), finished: [...next.finished], couplets: [...next.couplets] });
    this.set(next);
  }
}
