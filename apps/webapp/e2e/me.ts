import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { newId, openAccountApp, signInAs, type FakeAccount } from "./account";
import { tabBar } from "./browse";

/** The Tehran day the pages are told it is (`browse.ts`), as the number the stats keep: 1405-09-02, Monday 23 November 2026. */
export const todayNumber = Date.UTC(2026, 10, 23) / 86_400_000;

/** Opens a page of Me with the debug divan (the phone's `-beytSeedDivan 1`) in front, when asked. */
export async function openMe(page: Page, path = "/me", { seed = false }: { seed?: boolean } = {}) {
  if (seed) await page.addInitScript(() => sessionStorage.setItem("beytSeedDivan", "1"));
  await openAccountApp(page, path);
}

/** From a guest's profile: «ورود» opens the gate, and the debug sign-in signs in as `account`. */
export async function signInFromProfile(page: Page, account: FakeAccount = {}) {
  await page.getByTestId("profile-sign-in").click();
  await page.getByRole("dialog", { name: /یه حساب لازمه/ }).waitFor();
  await signInAs(page, { id: newId(), username: "niloofar", ...account });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("profile-username")).toContainText(`@${account.username ?? "niloofar"}`);
}

/** The tab «من», then the gear: the settings. */
export async function openSettings(page: Page) {
  await tabBar(page).getByRole("link", { name: "من" }).click();
  await page.getByRole("button", { name: "تنظیمات" }).click();
  await expect(page.getByRole("heading", { name: "تنظیمات" })).toBeVisible();
}

/** The toasts on the page (the announcer repeats their text for screen readers, so a text is looked for inside the region). */
export const toasts = (page: Page) => page.getByRole("region", { name: "اعلان‌ها" });

/** What the browser keeps in localStorage under `key`. */
export const kept = (page: Page, key: string) => page.evaluate((name) => localStorage.getItem(name), key);

/** What the account says of itself (the web app's own session route, which answers with the user). */
export const sessionUser = (page: Page) => page.evaluate(async () => ((await (await fetch("/auth/session")).json()) as { user?: Record<string, unknown> }).user);

/** After scrolling to the end: the page's content ends above the tab bar (phones) or beside the rail (wide screens), so nothing is under it. */
export async function clearOfTabBar(page: Page): Promise<boolean> {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(150);
  return page.evaluate(() => {
    const nav = document.querySelector("nav[aria-label='تب‌ها']")!.getBoundingClientRect();
    const content = document.querySelector("main")!.firstElementChild!.getBoundingClientRect();
    return nav.height > nav.width ? content.right <= nav.left || content.left >= nav.right : content.bottom <= nav.top;
  });
}
