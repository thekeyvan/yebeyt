import type { Metadata } from "next";
import type { Lookup } from "./lookup";
import { smartBanner, type LinkView } from "./links";

/** Title, Open Graph tags and the Smart App Banner of a link page. The pages are for one person each, so no indexing. */
export function linkMetadata(view: LinkView): Metadata {
  const banner = smartBanner(view.url);
  return {
    title: view.heading,
    description: view.description,
    robots: { index: false },
    openGraph: { title: view.heading, description: view.description, url: view.url },
    ...(banner ? { other: { "apple-itunes-app": banner } } : {}),
  };
}

export const UNAVAILABLE_TITLE = "الان نشد";

/** The metadata of a link page for whatever the lookup found. */
export function lookupMetadata<T>(found: Lookup<T>, view: (data: T) => LinkView, missingTitle: string): Metadata {
  if (found.status === "found") return linkMetadata(view(found.data));
  return { title: found.status === "missing" ? missingTitle : UNAVAILABLE_TITLE, robots: { index: false } };
}
