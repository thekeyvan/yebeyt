import { fromWire, isKept, merged, toWire, type DivanItem } from "./divan";
import { readJSON, Store, writeJSON, type KeyValueStorage, type RemovableStorage } from "./store";

/** The line shown when a couplet is taken out of the divan, with the button that brings it back. */
export const divanRemoved = "از دیوانت برداشته شد";

export type Mark = "liked" | "reposted" | "kept";

/** Where the marks are kept in localStorage: the same names as iOS's UserDefaults, and the same JSON. */
export const marksKey = "reader.marks";
export const divanKey = "reader.divan";

/** Keys look like «/hafez/ghazal/sh3#1» (the poem path and the 0-based couplet index). */
export const coupletKey = (poemPath: string, couplet: number): string => `${poemPath}#${couplet}`;

type State = { reactions: { liked: ReadonlySet<string>; reposted: ReadonlySet<string> }; divan: ReadonlyMap<string, DivanItem> };

function load(storage: KeyValueStorage): State {
  const saved = readJSON(storage, marksKey) as Partial<Record<Mark, unknown>> | undefined;
  const keys = (mark: "liked" | "reposted") => new Set(Array.isArray(saved?.[mark]) ? (saved[mark] as unknown[]).filter((key): key is string => typeof key === "string") : []);
  const items = readJSON(storage, divanKey);
  const divan = new Map<string, DivanItem>();
  for (const item of Array.isArray(items) ? items.map(fromWire) : []) if (item) divan.set(item.key, item);
  return { reactions: { liked: keys("liked"), reposted: keys("reposted") }, divan };
}

/**
 * What the reader has marked in this browser, per couplet (Reader/ReaderMarks.swift): پسند, بازنشر and نگه دار. The first two
 * are kept as lists of keys (they belong to an account: `ReactionsSync` keeps them the same on the server, and they go when the person signs out),
 * نگه دار is the divan: each couplet has the time it was kept and the time it was taken out, so that `DivanSync` can merge it with the server's divan.
 */
export class ReaderMarks extends Store<State> {
  /** Called after the person keeps or un-keeps a couplet (not after a merge from the server). */
  onKeptChange?: () => void;
  /** Called after the person likes, un-likes, reposts or un-reposts a couplet: the key, the kind and whether it is on now. */
  onReactionChange?: (key: string, kind: "like" | "repost", on: boolean) => void;

  constructor(
    private readonly storage: RemovableStorage,
    private readonly now: () => number = Date.now,
  ) {
    super(load(storage));
  }

  contains(mark: Mark, poemPath: string, couplet: number): boolean {
    return this.has(this.snapshot(), mark, coupletKey(poemPath, couplet));
  }

  /** Turns the mark on or off; returns whether it is on now. */
  toggle(mark: Mark, poemPath: string, couplet: number): boolean {
    const key = coupletKey(poemPath, couplet);
    const { reactions, divan } = this.snapshot();
    if (mark === "kept") return this.flipKept(key, reactions, divan);
    const keys = new Set(reactions[mark]);
    const on = !keys.delete(key);
    if (on) keys.add(key);
    this.saveReactions({ ...reactions, [mark]: keys }, divan);
    this.onReactionChange?.(key, mark === "liked" ? "like" : "repost", on);
    return on;
  }

  /**
   * «نگه دار» in one tap: keeps the couplet, or takes it out of the divan without asking (it is easy to take back): `offerUndo`
   * is then given the line to show and the way back. The way back keeps it again after the removal, so the last change per couplet wins.
   */
  toggleKept(poemPath: string, couplet: number, offerUndo: (text: string, undo: { run: () => void }) => void): void {
    if (this.toggle("kept", poemPath, couplet)) return;
    offerUndo(divanRemoved, {
      run: () => {
        if (!this.contains("kept", poemPath, couplet)) this.toggle("kept", poemPath, couplet);
      },
    });
  }

  /** The keys of what is marked now. */
  keys(mark: Mark): Set<string> {
    const { reactions, divan } = this.snapshot();
    return mark === "kept" ? new Set([...divan.values()].filter(isKept).map((item) => item.key)) : new Set(reactions[mark]);
  }

  /** The couplets that are kept now, the newest first. */
  keptItems(): DivanItem[] {
    return [...this.snapshot().divan.values()].filter(isKept).sort((a, b) => (b.keptAt ?? 0) - (a.keptAt ?? 0) || (a.key < b.key ? -1 : 1));
  }

  private has({ reactions, divan }: State, mark: Mark, key: string): boolean {
    const item = divan.get(key);
    return mark === "kept" ? item !== undefined && isKept(item) : reactions[mark].has(key);
  }

  private flipKept(key: string, reactions: State["reactions"], divan: State["divan"]): boolean {
    const stamp = this.now();
    const item: DivanItem = { ...divan.get(key), key };
    const on = !isKept(item);
    if (on) item.keptAt = Math.max(stamp, (item.removedAt ?? 0) + 1);
    else item.removedAt = Math.max(stamp, item.keptAt ?? 0);
    this.saveDivan(reactions, new Map(divan).set(key, item));
    this.onKeptChange?.();
    return on;
  }

  /** Every couplet the divan has a record of, the removed ones too, by key. */
  divanItems(): DivanItem[] {
    return [...this.snapshot().divan.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  }

  /** Merges what the server has (or another source): the later of each time wins. */
  applyDivan(items: readonly DivanItem[]): void {
    const { reactions, divan } = this.snapshot();
    const next = new Map(divan);
    let changed = false;
    for (const item of items) {
      const known = next.get(item.key);
      const both = known ? merged(known, item) : item;
      if (!known || both.keptAt !== known.keptAt || both.removedAt !== known.removedAt) {
        next.set(item.key, both);
        changed = true;
      }
    }
    if (changed) this.saveDivan(reactions, next);
  }

  /** Forgets the divan and its times (after signing out or deleting the account). */
  clearDivan(): void {
    this.storage.removeItem(divanKey);
    this.set({ reactions: this.snapshot().reactions, divan: new Map() });
  }

  /** Takes what the server has of one kind (likes or reposts): it replaces this browser's, except the couplets in `unsent`, which were changed here and not sent yet and keep their state. */
  applyServer(keys: ReadonlySet<string>, mark: "liked" | "reposted", unsent: ReadonlySet<string>): void {
    const { reactions, divan } = this.snapshot();
    const local = reactions[mark];
    const next = new Set([...keys].filter((key) => !unsent.has(key)));
    for (const key of local) if (unsent.has(key)) next.add(key);
    if (next.size === local.size && [...next].every((key) => local.has(key))) return;
    this.saveReactions({ ...reactions, [mark]: next }, divan);
  }

  /** Forgets the likes and reposts (after signing out or deleting the account: they belong to the account). */
  clearLikesAndReposts(): void {
    this.storage.removeItem(marksKey);
    this.set({ reactions: { liked: new Set(), reposted: new Set() }, divan: this.snapshot().divan });
  }

  private saveReactions(reactions: State["reactions"], divan: State["divan"]): void {
    writeJSON(this.storage, marksKey, { liked: [...reactions.liked], reposted: [...reactions.reposted] });
    this.set({ reactions, divan });
  }

  private saveDivan(reactions: State["reactions"], divan: State["divan"]): void {
    writeJSON(this.storage, divanKey, [...divan.values()].sort((a, b) => (a.key < b.key ? -1 : 1)).map(toWire));
    this.set({ reactions, divan });
  }
}
