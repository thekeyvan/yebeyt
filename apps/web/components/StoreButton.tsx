"use client";

import { copyText } from "../lib/clipboard";
import { APP_STORE_URL } from "../lib/config";

/**
 * «نصب «یه بیت» از اپ‌استور»: copies this page's link first, so the app can offer to open it after the install
 * (it reads the clipboard once, on its first launch), then goes to the App Store. It is the main button while there is no App Clip. Without JavaScript it is a plain link.
 */
export function StoreButton({ pageUrl, primary = false }: { pageUrl: string; primary?: boolean }) {
  return (
    <a
      className={primary ? "button primary" : "button secondary"}
      href={APP_STORE_URL}
      onClick={async (event) => {
        event.preventDefault();
        await copyText(pageUrl);
        window.location.href = APP_STORE_URL;
      }}
    >
      نصب «یه بیت» از اپ‌استور
    </a>
  );
}
