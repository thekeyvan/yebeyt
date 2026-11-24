import type { Metadata } from "next";

export type Lang = "fa" | "en";
/** The pages that exist in both languages; "" is the home page. */
export type Doc = "" | "privacy" | "terms" | "support";

export const BRAND: Record<Lang, string> = { fa: "یه بیت", en: "yebeyt" };
const LOCALE: Record<Lang, string> = { fa: "fa_IR", en: "en_US" };

/** The URL of a page in a language: Persian at the root, English under /en. */
export function docPath(lang: Lang, doc: Doc): string {
  if (lang === "fa") return `/${doc}`;
  return doc ? `/en/${doc}` : "/en";
}

/**
 * Title, description, Open Graph tags and the canonical and hreflang links of a page that exists in both languages.
 * The home page (`doc` empty) uses its title as it is; the others get the language's «· name» ending.
 */
export function docMetadata(lang: Lang, doc: Doc, title: string, description: string): Metadata {
  const url = docPath(lang, doc);
  const fullTitle = doc ? `${title} · ${BRAND[lang]}` : title;
  return {
    title: doc ? title : { absolute: title },
    description,
    openGraph: { title: fullTitle, description, url, siteName: BRAND[lang], locale: LOCALE[lang], type: "website" },
    alternates: { canonical: url, languages: { fa: docPath("fa", doc), en: docPath("en", doc) } },
  };
}
