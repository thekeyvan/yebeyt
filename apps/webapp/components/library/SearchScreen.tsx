"use client";

import { useEffect, useMemo, useState } from "react";
import { useCorpus } from "../../lib/library/browser";
import type { Library } from "../../lib/library/library";
import { normalize } from "../../lib/library/normalize";
import { searchHref } from "../../lib/library/routes";
import { isEmpty, search, type CoupletCorpus } from "../../lib/library/search";
import { Screen } from "../shell/Screen";
import { LoadFailed, WithLibrary } from "./WithLibrary";
import { BackButton, SearchBox } from "./chrome";
import { BookRow, CoupletRow, NothingFound, PoetRow } from "./rows";

/** Searching on every key press would redo the work for text that is already gone. */
const settleMs = 250;

const Heading = ({ children }: { children: string }) => <h2 className="pt-2.5 text-xl text-ink">{children}</h2>;

/** Search: poets, books and couplets (from the bundled books), in the row styles of the library (Search/SearchScreen.swift). The text is kept in the address (`?q=`). */
export function SearchScreen({ initial }: { initial: string }) {
  const [query, setQuery] = useState(initial);
  const [settled, setSettled] = useState(initial);
  const { value: corpus, failed, retry } = useCorpus();

  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(query);
      window.history.replaceState(window.history.state, "", searchHref(query.trim()));
    }, settleMs);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <WithLibrary>
      {({ library }) => <Found library={library} query={query} settled={settled} corpus={corpus} failed={failed} onRetry={retry} onQuery={setQuery} />}
    </WithLibrary>
  );
}

type FoundProps = { library: Library; query: string; settled: string; corpus: CoupletCorpus | undefined; failed: boolean; onRetry: () => void; onQuery: (text: string) => void };

function Found({ library, query, settled, corpus, failed, onRetry, onQuery }: FoundProps) {
  const results = useMemo(() => (normalize(settled) === "" ? undefined : search(library, settled, corpus)), [library, settled, corpus]);
  return (
    <Screen
      header={
        <div className="flex items-center gap-3">
          <BackButton fallback="/explore" />
          <SearchBox round autoFocus value={query} onChange={onQuery} placeholder="شاعر، شعر یا یه تیکه از بیت…" />
        </div>
      }
    >
      <div className="flex flex-col gap-2 pt-1.5">
        {failed && <LoadFailed title="بیت‌ها باز نشد" onRetry={onRetry} />}
        {results && corpus && isEmpty(results) && <NothingFound />}
        {results && results.poets.length > 0 && (
          <>
            <Heading>شاعرها</Heading>
            {results.poets.map((poet) => <PoetRow key={poet.slug} poet={poet} />)}
          </>
        )}
        {results && results.books.length > 0 && (
          <>
            <Heading>کتاب‌ها</Heading>
            {results.books.map((book) => <BookRow key={book.id} book={book} poetName={library.poetOf(book)?.name ?? ""} />)}
          </>
        )}
        {results && results.couplets.length > 0 && (
          <>
            <Heading>بیت‌ها</Heading>
            {results.couplets.map((entry) => <CoupletRow key={entry.id} entry={entry} poetName={library.poet(entry.poet)?.name ?? ""} />)}
          </>
        )}
      </div>
    </Screen>
  );
}
