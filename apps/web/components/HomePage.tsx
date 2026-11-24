import { TopBar } from "./Brand";
import { SiteFooter } from "./SiteFooter";
import { APP_STORE_URL } from "../lib/config";
import { BRAND, type Lang } from "../lib/site";

const TEXT = {
  fa: {
    tagline: "هر بیت، یه بازی.",
    lead: (
      <>
        هر روز یه بیت برای تو، بازی با شعر،
        <br />و مشاعره با دوستات.
      </>
    ),
    button: "دانلود از اپ‌استور",
  },
  en: {
    tagline: "Every couplet, a game.",
    lead: (
      <>
        A new couplet every day, games with poetry,
        <br />
        and mosha&apos;ere with your friends.
      </>
    ),
    button: "Download on the App Store",
  },
};

/** The home page, in one language. */
export function HomePage({ lang }: { lang: Lang }) {
  const t = TEXT[lang];
  return (
    <div className="page">
      <TopBar lang={lang} doc="" />
      <main>
        <div className="home">
          <span className="verse" lang="fa" dir="rtl" aria-hidden="true">
            الا یا ایها الساقی
            <br />
            ادر کأسا و ناولها
          </span>
          <span className="stickers" aria-hidden="true">
            <span />
            <span />
          </span>
          <h1>{BRAND[lang]}</h1>
          <p className="tagline">{t.tagline}</p>
          <p className="lead">{t.lead}</p>
          <a className="button primary" href={APP_STORE_URL}>
            {t.button}
          </a>
        </div>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
