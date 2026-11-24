import { Brand } from "./Brand";
import { SiteFooter } from "./SiteFooter";

/** The friendly page of a link that leads nowhere. Rendered with status 404 by the pages' not-found files. */
export function Missing({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="page">
      <div className="top">
        <Brand />
      </div>
      <main className="link missing">
        <h1>{title}</h1>
        <p>{hint}</p>
        <a className="button primary" href="/">
          یه بیت
        </a>
      </main>
      <SiteFooter />
    </div>
  );
}
