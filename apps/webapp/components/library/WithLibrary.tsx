"use client";

import type { ReactNode } from "react";
import { useLibraryData, type LibraryData } from "../../lib/library/browser";
import { Screen } from "../shell/Screen";
import { Button } from "../ui/Button";
import { BackButton } from "./chrome";

/**
 * Calls `children` with the library once it has loaded in the browser; until then the page is empty and busy, and when it fails it says so and
 * offers «دوباره». The placeholder is a whole screen, unless `inScreen`: the caller has its own, and the placeholder only fills a part of it.
 */
export function WithLibrary({ children, inScreen }: { children: (data: LibraryData) => ReactNode; inScreen?: boolean }) {
  const { value, failed, retry } = useLibraryData();
  if (value) return <>{children(value)}</>;
  const placeholder = failed ? (
    <div role="alert" className="flex flex-col items-center gap-4 pt-24">
      <p className="font-title text-2xl">کتابخونه باز نشد</p>
      <Button variant="ghost" onClick={retry}>
        دوباره
      </Button>
    </div>
  ) : (
    <div aria-busy className="h-[60dvh]" />
  );
  return inScreen ? placeholder : <Screen>{placeholder}</Screen>;
}

/** A screen for something the library does not have (a book path that is not one): the way back, and a line saying so. */
export function Missing({ fallback }: { fallback: string }) {
  return (
    <Screen header={<BackButton fallback={fallback} />}>
      <p role="alert" className="pt-24 text-center font-title text-2xl text-muted">
        اینجا چیزی پیدا نشد
      </p>
    </Screen>
  );
}
