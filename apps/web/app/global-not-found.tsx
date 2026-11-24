import type { Metadata } from "next";
import { Missing } from "../components/Missing";
import "./tokens.css";
import "./globals.css";

export const metadata: Metadata = { title: "این صفحه پیدا نشد · یه بیت", robots: { index: false } };

/** The 404 of every URL that matches no route. There are two root layouts (Persian and English), so no layout can wrap it. */
export default function GlobalNotFound() {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <Missing title="این صفحه پیدا نشد" hint="ممکنه آدرس اشتباه باشه." />
      </body>
    </html>
  );
}
