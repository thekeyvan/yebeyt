import { test, type Page } from "@playwright/test";
import { openSignedIn } from "./friends";
import { fakeLive } from "./messages";
import { openAsGuest, playRound, playToRoundFour } from "./play";

// Screenshots of the games with friends at the small phone (not committed: e2e/__screenshots__ is ignored).
const shot = (page: Page, name: string) => page.screenshot({ path: `e2e/__screenshots__/web8-${name}.png` });
const settled = (page: Page) => page.waitForTimeout(900);

test.beforeEach(async ({}, info) => {
  const { width, height } = info.project.use.viewport!;
  test.skip(!info.project.name.startsWith("chromium") || !(width === 375 && height === 667), "one browser, the small phone");
});

test("the lobby, مشاعره on my turn and a duel in the middle of a round", async ({ page }) => {
  const live = await fakeLive(page);
  await openSignedIn(page, "/messages/sara.ghazal");
  await page.getByTestId("quick-mosh").click();
  await page.getByTestId("lobby-person-sara.ghazal").getByText("سارا").waitFor();
  await settled(page);
  await shot(page, "lobby");
  await page.goto("/games/mosh/g1");
  await page.locator("[data-testid^=mosh-suggestion-]").first().waitFor();
  await settled(page);
  await shot(page, "mosh");
  await page.goto("/games/duel/d1");
  await playToRoundFour(live);
  await page.getByTestId("duel-answered").waitFor();
  await page.getByTestId("option-0").click();
  await settled(page);
  await shot(page, "duel");
});

test("the challenge card after a round, the board of a challenge and a guest asked for a name", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => sessionStorage.setItem("beytSeed", "1"));
  await openSignedIn(page, "/games/jigsaw");
  await playRound(page);
  await page.getByTestId("challenge-link").getByText("yebeyt.com/c/7KQ2").waitFor();
  await settled(page);
  await shot(page, "challenge-send");
  await page.goto("/c/7KQ2");
  await page.getByTestId("challenge-title").waitFor();
  await settled(page);
  await shot(page, "challenge-board");
});

test("a guest asked for a name", async ({ page }) => {
  test.setTimeout(240_000);
  await openAsGuest(page, "/c/7KQ2");
  await page.getByTestId("challenge-start").click();
  await playRound(page);
  await page.getByTestId("challenge-name-card").waitFor();
  await settled(page);
  await shot(page, "guest-name");
});
