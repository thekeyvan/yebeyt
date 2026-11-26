import { expect, type Page } from "@playwright/test";
import { stubNetwork } from "./reader";

/** The Tehran day the pages are told it is (`-beytToday`): Monday 2 Azar 1405. Its couplet is ghazal 121 of Hafez, couplet 7 (index 6); after one «رد کن», ghazal 195, couplet 4. */
export const today = "2026-11-23";
export const todaysCouplet = { path: "/hafez/ghazal/sh121", index: 6, text: "بَلاگردانِ جان و تن" };
export const nextCouplet = { path: "/hafez/ghazal/sh195", index: 3, text: "گُذار کُن چو صَبا" };

export const tabBar = (page: Page) => page.getByRole("navigation", { name: "تب‌ها" });

/** Opens a page of the app with no network except the app itself, on the fixed day. */
export async function openApp(page: Page, path: string) {
  await stubNetwork(page);
  await page.addInitScript((day) => sessionStorage.setItem("beytToday", day), today);
  await page.goto(path);
}

/** The reader is up over the page, on this poem. */
export async function expectReader(page: Page, title: string | RegExp) {
  await expect(page.getByTestId("reader-title")).toHaveText(title);
}

/** Closes the reader with its round button and waits for it to be gone. */
export async function closeReader(page: Page) {
  await page.getByRole("button", { name: "بستن" }).click();
  await expect(page.getByTestId("reader")).toHaveCount(0);
}

/** The couplet number in the address (`?c=`). */
export const coupletInAddress = (page: Page) => Number(new URL(page.url()).searchParams.get("c"));

/** From now on, notes how far (pixels sideways) and how faint (opacity) the deck's card gets, frame by frame. */
export const watchDeckCard = (page: Page) =>
  page.evaluate(() => {
    const seen = { farthest: 0, dimmest: 1 };
    (window as unknown as { __deck: typeof seen }).__deck = seen;
    const loop = () => {
      const card = document.querySelector<HTMLElement>("[data-testid=deck-card]");
      if (card) {
        const style = getComputedStyle(card);
        seen.farthest = Math.max(seen.farthest, Math.abs(new DOMMatrix(style.transform).m41));
        seen.dimmest = Math.min(seen.dimmest, Number(style.opacity));
      }
      requestAnimationFrame(loop);
    };
    loop();
  });

export const deckCardWatched = (page: Page) => page.evaluate(() => (window as unknown as { __deck: { farthest: number; dimmest: number } }).__deck);
