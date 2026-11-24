import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SITE_URL } from "../lib/config";
import "./tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "یه بیت · هر بیت، یه بازی", template: "%s · یه بیت" },
  description: "یه بیت: شعر فارسی، بازی با بیت‌ها و مشاعره با دوستات.",
  openGraph: { siteName: "یه بیت", locale: "fa_IR", type: "website" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#F1EFEA" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
