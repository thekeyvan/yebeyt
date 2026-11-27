import { test, type Page } from "@playwright/test";
import { openSignedIn } from "./friends";

// Screenshots of the messages screens at the small phone, and the two panes at the desktop (not committed: e2e/__screenshots__ is ignored).
const shot = (page: Page, name: string) => page.screenshot({ path: `e2e/__screenshots__/web7-${name}.png` });
const settled = (page: Page) => page.waitForTimeout(900);

test.beforeEach(async ({}, info) => {
  const { width, height } = info.project.use.viewport!;
  test.skip(!info.project.name.startsWith("chromium") || !((width === 375 && height === 667) || (width === 1280 && height === 800)), "one browser, the small phone and the desktop");
});

test("the inbox, Sara's chat, the couplet picker, the shared divan and the friend pick sheet", async ({ page }) => {
  test.skip(page.viewportSize()!.width !== 375, "the phone's screens");
  await openSignedIn(page, "/messages");
  await page.getByTestId("inbox-row-bardia").waitFor();
  await settled(page);
  await shot(page, "inbox");
  await page.goto("/messages/sara.ghazal");
  await page.getByTestId("couplet-card-m1").getByText("حافظ").waitFor();
  await settled(page);
  await shot(page, "chat");
  await page.getByTestId("quick-couplet").click();
  const picker = page.getByRole("dialog", { name: "بیت بفرست" });
  await picker.getByRole("searchbox").fill("اگر آن ترک");
  await picker.getByTestId("pick-/hafez/ghazal/sh3#0").waitFor();
  await settled(page);
  await shot(page, "picker");
  await page.goto("/messages/sara.ghazal/divan");
  await page.getByTestId("shared-item-i2").getByText("خیام ·").waitFor();
  await settled(page);
  await shot(page, "shared-divan");
  await page.goto("/poem/hafez/ghazal/sh3?c=1");
  await page.getByTestId("couplet-1").click({ button: "right" });
  await page.getByRole("dialog", { name: "کارهای این بیت" }).getByRole("button", { name: "به دیوان مشترک" }).click();
  await page.getByTestId("divan-with-sara.ghazal").waitFor();
  await page.getByTestId("other-friend").click();
  await page.getByTestId("divan-with-mahsa.m").waitFor();
  await settled(page);
  await shot(page, "friend-pick");
});

test("two panes: the inbox beside Sara's chat", async ({ page }) => {
  test.skip(page.viewportSize()!.width < 1024, "the desktop's screens");
  await openSignedIn(page, "/messages/sara.ghazal");
  await page.getByTestId("couplet-card-m1").getByText("حافظ").waitFor();
  await page.getByTestId("inbox-row-bardia").waitFor();
  await settled(page);
  await shot(page, "two-panes");
});
