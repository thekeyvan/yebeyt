import { test, type Page } from "@playwright/test";
import { chooseFromMenu, openSignedIn } from "./friends";

// Screenshots of the friends screens at the small phone, and the leaderboard at the desktop (not committed: e2e/__screenshots__ is ignored).
const shot = (page: Page, name: string) => page.screenshot({ path: `e2e/__screenshots__/web6-${name}.png` });
const settled = (page: Page) => page.waitForTimeout(900);

test.beforeEach(async ({}, info) => {
  const { width, height } = info.project.use.viewport!;
  test.skip(!info.project.name.startsWith("chromium") || !((width === 375 && height === 667) || (width === 1280 && height === 800)), "one browser, the small phone and the desktop");
});

const phoneOnly = (page: Page) => test.skip(page.viewportSize()!.width !== 375, "the phone's screens");

test("people search and a person's page in each state, the menu and the report", async ({ page }) => {
  phoneOnly(page);
  await openSignedIn(page, "/people?q=ar");
  await page.getByTestId("person-aryan").waitFor();
  await settled(page);
  await shot(page, "people-search");
  await page.getByRole("searchbox").fill("ye");
  await page.getByTestId("person-yebeyt").waitFor();
  await settled(page);
  await shot(page, "people-search-house");

  for (const [username, state] of [["raha", "none"], ["paria", "requested"], ["aryan", "incoming"], ["kian_k", "friend"]]) {
    await page.goto(`/u/${username}`);
    await page.getByTestId("person-name").waitFor();
    await settled(page);
    await shot(page, `person-${state}`);
  }
  await chooseFromMenu(page, "unfriend").catch(() => undefined);
  await page.goto("/u/kian_k");
  await page.getByTestId("person-friend-chip").waitFor();
  await page.getByTestId("person-menu").click();
  await page.getByTestId("block-item").waitFor();
  await settled(page);
  await shot(page, "person-menu");
  await page.keyboard.press("Escape");
  await page.goto("/u/raha");
  await page.getByTestId("person-name").waitFor();
  await chooseFromMenu(page, "report");
  await page.getByTestId("report-note").fill("پیام نامناسب فرستاد");
  await settled(page);
  await shot(page, "report");
});

test("the requests, my friends and the home «دوستات»", async ({ page }) => {
  phoneOnly(page);
  await openSignedIn(page, "/messages");
  await page.getByTestId("requests-row").waitFor();
  await settled(page);
  await shot(page, "messages-requests-row");
  await page.getByTestId("requests-row").click();
  await page.getByTestId("request-paria").waitFor();
  await settled(page);
  await shot(page, "requests");
  await page.goto("/me");
  await page.getByTestId("profile-friends").waitFor();
  await settled(page);
  await shot(page, "profile-friends");
  await page.goto("/me/friends");
  await page.getByTestId("person-kian_k").waitFor();
  await settled(page);
  await shot(page, "my-friends");
  await page.goto("/");
  await page.getByTestId("feed-couplet").first().waitFor();
  await page.getByTestId("friends-feed").scrollIntoViewIfNeeded();
  await page.getByTestId("friends-feed").evaluate((node) => node.scrollIntoView({ block: "start" }));
  await settled(page);
  await shot(page, "home-friends");
});

test("the leaderboard: the league, friends and everyone", async ({ page }) => {
  const phone = page.viewportSize()!.width === 375;
  await openSignedIn(page, "/games/leaderboard");
  await page.getByTestId("board-row-1").waitFor();
  await settled(page);
  await shot(page, phone ? "leaderboard-league" : "leaderboard-1280");
  if (!phone) return;
  await page.getByRole("radio", { name: "دوستا" }).click();
  await page.getByTestId("board-row-4").waitFor();
  await settled(page);
  await shot(page, "leaderboard-friends");
  await page.getByRole("radio", { name: "همه" }).click();
  await page.getByTestId("global-hidden").waitFor();
  await settled(page);
  await shot(page, "leaderboard-global");
});
