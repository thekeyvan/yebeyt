"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { poetryStore } from "../poetry/browser";
import type { Store } from "../reader/store";
import type { BookIndex } from "./bookIndex";
import { dayNumber } from "./date";
import { Follows } from "./follows";
import { HomeModel, type HomeState } from "./home";
import { BookIndexes } from "./indexes";
import { Library } from "./library";
import type { LibraryBook, LibraryFile } from "./models";
import { PoetPictures, type PoetPictureEntry } from "./pictures";
import { ReadingProgress } from "./progress";
import type { CoupletCorpus } from "./search";
import { homeSource, loadCorpus } from "./sources";
import { today } from "./today";

export type LibraryData = { library: Library; indexes: BookIndexes };

async function fetchData(name: string): Promise<unknown> {
  const response = await fetch(`/data/${name}.json`);
  if (!response.ok) throw new Error(`missing bundled file ${name}`);
  return response.json();
}

// Made when first asked for, in the browser only; a failed load is tried again next time.
let loading: Promise<LibraryData> | undefined;
let ready: LibraryData | undefined;
let corpus: Promise<CoupletCorpus> | undefined;
let home: Promise<HomeModel> | undefined;
let homeReady: HomeModel | undefined;

/** The curated library (library.json) and the loader of the poem index of each book (`index-<id>.json`), all from /data. */
export function libraryData(): Promise<LibraryData> {
  loading ??= fetchData("library")
    .then((file) => (ready = { library: new Library(file as LibraryFile), indexes: new BookIndexes(fetchData) }))
    .catch((error: unknown) => {
      loading = undefined;
      throw error;
    });
  return loading;
}

/** The couplets of the bundled books, for search and the moods. */
function coupletCorpus(): Promise<CoupletCorpus> {
  corpus ??= Promise.all([libraryData(), poetryStore()])
    .then(([{ library, indexes }, poetry]) => loadCorpus(library, indexes, poetry))
    .catch((error: unknown) => {
      corpus = undefined;
      throw error;
    });
  return corpus;
}

function homeModel(): Promise<HomeModel> {
  home ??= Promise.all([libraryData(), poetryStore()])
    .then(([{ library, indexes }, poetry]) => (homeReady = new HomeModel(dayNumber(today()), localStorage, homeSource(library, indexes, poetry))))
    .catch((error: unknown) => {
      home = undefined;
      throw error;
    });
  return home;
}

/** What is loaded in the browser (`undefined` while it loads), and whether it failed: `retry` asks again. `key` names what `load` loads. */
export function useLoaded<T>(load: () => Promise<T>, initial?: T, key = ""): { value: T | undefined; failed: boolean; retry: () => void } {
  const [state, setState] = useState<{ value: T | undefined; failed: boolean; attempt: number }>({ value: initial, failed: false, attempt: 0 });
  useEffect(() => {
    let current = true;
    load().then(
      (value) => current && setState((previous) => ({ ...previous, value, failed: false })),
      () => current && setState((previous) => ({ ...previous, value: undefined, failed: true })),
    );
    return () => {
      current = false;
    };
    // `load` is new on every render; what it loads is named by `key` and the attempt.
  }, [key, state.attempt]);
  return { value: state.value, failed: state.failed, retry: () => setState((previous) => ({ ...previous, failed: false, attempt: previous.attempt + 1 })) };
}

export const useLibraryData = () => useLoaded(libraryData, ready);

/** The poem index of a book, once it has loaded. */
export function useBookIndex(data: LibraryData, book: LibraryBook | undefined): BookIndex | undefined {
  return useLoaded(() => (book ? data.indexes.index(book) : Promise.resolve(undefined)), undefined, String(book?.id)).value;
}

export const useCorpus = () => useLoaded(coupletCorpus);

/** The state of a store, drawn again when it changes; `undefined` for a store that is not there yet. */
export function useStore<T>(store: Store<T> | undefined): T | undefined {
  return useSyncExternalStore(
    (listener) => store?.subscribe(listener) ?? (() => {}),
    () => store?.snapshot(),
    () => undefined,
  );
}

// What this browser keeps: the follows, the reading progress and the poet pictures, in localStorage.
let follows: Follows | undefined;
let progress: ReadingProgress | undefined;
let pictures: PoetPictures | undefined;

const followsStore = (): Follows => (follows ??= new Follows(localStorage));

/** Where the reader was left in each poem; the reader writes it. */
export const progressStore = (): ReadingProgress => (progress ??= new ReadingProgress(localStorage));

const picturesStore = (): PoetPictures => (pictures ??= new PoetPictures(localStorage));

/** The follows of this browser; the page draws again when they change. */
export function useFollows(): Follows {
  const store = followsStore();
  useStore(store);
  return store;
}

/** The reading progress of this browser; the page draws again when it changes. */
export function useProgress(): ReadingProgress {
  const store = progressStore();
  useStore(store);
  return store;
}

const noPictures: Readonly<Record<string, PoetPictureEntry>> = {};

/** The poet pictures the server has, by slug (none until the browser asks: the circles show their letters). Asked once a minute at most. */
export function usePictures(): Readonly<Record<string, PoetPictureEntry>> {
  const store = picturesStore();
  useEffect(() => {
    void store.refresh();
  }, [store]);
  return useSyncExternalStore(store.subscribe, store.snapshot, () => noPictures);
}

/** Today's couplet and the way to reject it; it asks again when the page comes back after midnight. */
export function useHome(): { state: HomeState | undefined; model: HomeModel | undefined } {
  const [model, setModel] = useState(homeReady);
  useEffect(() => {
    let current = true;
    homeModel().then(
      (made) => {
        if (!current) return;
        setModel(made);
        void made.refresh(dayNumber(today())).then(() => made.load());
      },
      () => {},
    );
    const visible = () => document.visibilityState === "visible" && void homeModel().then((made) => made.refresh(dayNumber(today())), () => {});
    document.addEventListener("visibilitychange", visible);
    return () => {
      current = false;
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return { state: useStore(model), model };
}
