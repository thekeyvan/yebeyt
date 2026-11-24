"use client";

import { copyText } from "../lib/clipboard";
import { APP_STORE_URL } from "../lib/config";

/**
 * «نصب «یه بیت» از اپ‌استور»: copies this page's link first, so the app can offer to open it after the install
 * (it reads the clipboard once, on its first launch), then goes to the App Store. Without JavaScript it is a plain link.
 */
export function StoreButton({ pageUrl }: { pageUrl: string }) {
  return (
    <a
      className="button secondary"
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
