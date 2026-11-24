import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SITE_URL } from "../../../lib/config";
import "../../tokens.css";
import "../../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "yebeyt · Every couplet, a game", template: "%s · yebeyt" },
  description: "yebeyt: Persian poetry, games with couplets, and mosha'ere with your friends.",
  openGraph: { siteName: "yebeyt", locale: "en_US", type: "website" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#F1EFEA" };

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
