"use client";

import Link from "next/link";
import { poetHref } from "../../lib/library/routes";
import { Screen } from "../shell/Screen";
import { PoetTile } from "./PoetCircle";
import { ScreenHeader } from "./chrome";
import { WithLibrary } from "./WithLibrary";

/** «شاعرها»: every poet of the library as the same circles as the Explore row (Explore/AllPoetsScreen.swift). */
export function AllPoetsScreen() {
  return (
    <WithLibrary>
      {({ library }) => (
        <Screen header={<ScreenHeader title="شاعرها" fallback="/explore" />}>
          <ul className="grid grid-cols-4 gap-x-2 gap-y-3.5 pt-1.5">
            {library.poets.map((poet) => (
              <li key={poet.slug} className="flex justify-center">
                <Link href={poetHref(poet.slug)} data-testid={`poet-${poet.slug}`}>
                  <PoetTile poet={poet} />
                </Link>
              </li>
            ))}
          </ul>
        </Screen>
      )}
    </WithLibrary>
  );
}
