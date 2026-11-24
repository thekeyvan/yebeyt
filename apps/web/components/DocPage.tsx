import type { ReactNode } from "react";
import { TopBar } from "./Brand";
import { SiteFooter } from "./SiteFooter";
import type { Doc, Lang } from "../lib/site";

/** A page of text (privacy, terms, support) in one language; the top bar links to the same page in the other. */
export function DocPage({ lang, doc, children }: { lang: Lang; doc: Doc; children: ReactNode }) {
  return (
    <div className="page">
      <TopBar lang={lang} doc={doc} />
      <main>
        <article className={lang === "en" ? "doc card en" : "doc card"}>{children}</article>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
