import type { Metadata } from "next";
import { Brand } from "../components/Brand";
import { SiteFooter } from "../components/SiteFooter";
import { APP_STORE_URL } from "../lib/config";

const description = "هر روز یه بیت برای تو، بازی با شعر، و مشاعره با دوستات.";

export const metadata: Metadata = {
  title: { absolute: "یه بیت · هر بیت، یه بازی" },
  description,
  openGraph: { title: "یه بیت · هر بیت، یه بازی", description, url: "/" },
};

export default function Home() {
  return (
    <div className="page">
      <div className="top">
        <Brand />
      </div>
      <main>
        <div className="home">
          <span className="verse" aria-hidden="true">
            الا یا ایها الساقی
            <br />
            ادر کأسا و ناولها
          </span>
          <span className="stickers" aria-hidden="true">
            <span />
            <span />
          </span>
          <h1>یه بیت</h1>
          <p className="tagline">هر بیت، یه بازی.</p>
          <p className="lead">
            هر روز یه بیت برای تو، بازی با شعر،
            <br />و مشاعره با دوستات.
          </p>
          <a className="button primary" href={APP_STORE_URL}>
            دانلود از اپ‌استور
          </a>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
