import type { Page } from "@playwright/test";
import { openApp } from "./browse";

/** What a debug sign-in is made as (`DebugAccount`): the account of the phone's `-beytSignedIn 1`, answered by the web app's own door. */
export type FakeAccount = { id?: string; username?: string | null; displayName?: string | null; providerName?: string; provider?: "apple" | "google"; syncFails?: boolean };

/** Opens a page with the web app's door to the server open (its debug server answers the fake sign-in) and no onboarding, as a debug build does. */
export const openAccountApp = (page: Page, path: string) => openApp(page, path, { api: true });

/** As `openAccountApp`, with onboarding behaving as a release build's (`first`) or starting at a step. */
export async function openOnboarding(page: Page, start: string = "first", path = "/") {
  await page.addInitScript((step) => sessionStorage.setItem("beytOnboarding", step), start);
  await openAccountApp(page, path);
}

/** A fresh account of its own, so tests that share the debug server do not meet. */
export const newId = () => crypto.randomUUID();

/** Signs in as the phone's debug sign-in does, through the buttons' own code (the gate or the account step must be open). */
export const signInAs = (page: Page, account: FakeAccount) => page.evaluate((spec) => (window as unknown as { beytSignIn: (spec: unknown) => Promise<void> }).beytSignIn(spec), account);

/** What the server answers the page for `path` (the door adds the session). */
export const ask = (page: Page, path: string) => page.evaluate(async (url) => (await fetch(`/api${url}`)).json(), path);

/** The cookies of the session, as the browser keeps them. */
export const sessionCookies = (page: Page) => page.context().cookies().then((all) => all.filter((cookie) => cookie.name.startsWith("yb_")));

/** The page has no horizontal scroll. */
export const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
