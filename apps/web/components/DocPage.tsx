import type { ReactNode } from "react";
import { Brand } from "./Brand";
import { SiteFooter } from "./SiteFooter";

/** A page of text in two languages: Persian first, then English (`#en`). */
export function DocPage({ fa, en }: { fa: ReactNode; en: ReactNode }) {
  return (
    <div className="page">
      <div className="top">
        <Brand />
        <a className="lang" href="#en" lang="en">
          English
        </a>
      </div>
      <main>
        <article className="doc card">
          {fa}
          <hr />
          <section id="en" className="en" lang="en" dir="ltr">
            {en}
          </section>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
