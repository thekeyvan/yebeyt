import type { Metadata } from "next";
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

export const missingMetadata = (title: string): Metadata => ({ title, robots: { index: false } });
