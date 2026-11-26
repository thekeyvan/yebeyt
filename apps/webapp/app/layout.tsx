import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AccountProvider } from "../components/account/AccountProvider";
import { ToastHost } from "../components/ui/Toast";
import { colors } from "../lib/tokens";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "یه بیت", template: "%s · یه بیت" },
  description: "شعر فارسی، بازی با بیت‌ها و مشاعره با دوستات.",
  appleWebApp: { capable: true, title: "یه بیت", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-icon.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: colors.paper };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        {/* The paper stays put while the page scrolls over it, like the sheet behind a sticker. */}
        <div aria-hidden className="dotted-paper fixed inset-0 -z-10" />
        <AccountProvider>{children}</AccountProvider>
        <ToastHost />
      </body>
    </html>
  );
}
