import { expect, type Page } from "@playwright/test";
import { newId, openAccountApp, type FakeAccount } from "./account";

/**
 * Opens `path` signed in as a debug account (a fresh one, with the debug server's friends: سارا, کیان and مهسا and «یه بیت»; آرین and بردیا asked, پریا was asked, رها
 * nothing): the sign-in is made as the buttons make it (the door's `/auth/apple`, which the debug server answers), and the page is opened after it.
 */
export async function openSignedIn(page: Page, path: string, account: FakeAccount = {}) {
  // A page that is none of the tests' own (a navigation to the address already open makes WebKit return before the new page is there).
  await openAccountApp(page, "/me/licenses");
  const spec = { id: newId(), username: "niloofar", displayName: "نیلوفر", ...account };
  const answered = await page.evaluate(async (who) => {
    const token = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(who)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const answer = await fetch("/auth/apple", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identityToken: `debug-${token}`, nonce: "debug" }) });
    return answer.ok;
  }, spec);
  expect(answered).toBe(true);
  await page.goto(path);
}

/** The dialog that asks before an action («درخواستت رو پس بگیری؟»). */
export const asked = (page: Page, title: string | RegExp) => page.getByRole("dialog", { name: title });

/** The page is right-to-left and has no sideways scroll. */
export async function expectRightToLeftAndFits(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

/** Opens the ⋯ menu of a person's page and chooses `item`. */
export async function chooseFromMenu(page: Page, item: "unfriend" | "block" | "report") {
  await page.getByTestId("person-menu").click();
  await page.getByTestId(`${item}-item`).click();
}
