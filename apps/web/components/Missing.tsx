import { Brand } from "./Brand";
import { SiteFooter } from "./SiteFooter";
import { UNAVAILABLE_TITLE } from "../lib/pageMeta";

/** The friendly page of a link that leads nowhere. */
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

/** What a link page shows when the server did not answer. */
export const Unavailable = () => <Missing title={UNAVAILABLE_TITLE} hint="چند لحظه‌ی دیگه دوباره امتحان کن." />;
