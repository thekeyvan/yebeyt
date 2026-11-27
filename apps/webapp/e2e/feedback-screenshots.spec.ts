import { test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { openApp } from "./browse";
import { openSignedIn } from "./friends";
import { feedbackServer, form, openByKeyboard, openForm, thumbnail, titles } from "./feedback";

// Screenshots of the feedback screens at the small phone (not committed: e2e/__screenshots__ is ignored).
const shot = (page: Page, name: string) => page.screenshot({ path: `e2e/__screenshots__/web9-${name}.png` });
const settled = (page: Page) => page.waitForTimeout(900);

test.beforeEach(async ({}, info) => {
  const { width, height } = info.project.use.viewport!;
  test.skip(!info.project.name.startsWith("chromium") || width !== 375 || height !== 667, "one browser, the small phone");
});

test("the choices, the bug form with its screenshot, the editor, and the game idea", async ({ page }) => {
  await feedbackServer(page);
  await openSignedIn(page, "/messages/sara.ghazal");
  await page.getByTestId("bubble-m3").waitFor();
  await openByKeyboard(page);
  await settled(page);
  await shot(page, "choices");
  await page.getByTestId("feedback-type-bug").click();
  await form(page, titles.bug).waitFor();
  await page.getByTestId("feedback-thumbnail").waitFor();
  await page.getByTestId("feedback-text").fill("پیام‌ها دیر می‌رسن و گاهی هم دوبار می‌آن");
  await page.getByTestId("feedback-technical-toggle").click();
  await settled(page);
  await shot(page, "bug");
  // What the page looked like for the report: the chat, with every message and the field blank.
  writeFileSync("e2e/__screenshots__/web9-captured-chat.png", await thumbnail(page));
  await page.getByTestId("feedback-edit").scrollIntoViewIfNeeded();
  await page.getByTestId("feedback-edit").click();
  const canvas = page.getByTestId("editor-picture");
  await canvas.waitFor();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.25);
  await page.mouse.down();
  for (const [x, y] of [[0.3, 0.2], [0.45, 0.3], [0.6, 0.22], [0.8, 0.3]]) await page.mouse.move(box.x + box.width * x!, box.y + box.height * y!, { steps: 4 });
  await page.mouse.up();
  await page.getByRole("dialog", { name: "خط بکش یا بپوشون" }).getByText("بپوشون", { exact: true }).click();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.68, { steps: 6 });
  await page.mouse.up();
  await settled(page);
  await shot(page, "editor");
  await page.getByTestId("editor-close").click();
  await page.getByTestId("feedback-close").click();
  await page.getByRole("dialog", { name: "بازخوردت هنوز فرستاده نشده. ولش کنی؟" }).getByRole("button", { name: "ول کن" }).click();
  await openByKeyboard(page);
  await page.getByTestId("feedback-type-game").click();
  await page.getByTestId("feedback-game-name").fill("بیت عوضی");
  await page.getByTestId("feedback-text").fill("بیت‌ها قاطی می‌شن و باید جای هر مصراع رو پیدا کنی");
  await form(page, titles.game).getByText("هر دو", { exact: true }).click();
  await settled(page);
  await shot(page, "game-form");
});

test("the recording pill over a game", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("beytFakeRecorder", "1"));
  await feedbackServer(page);
  await openApp(page, "/games/daily");
  await page.getByTestId("game").waitFor();
  await openForm(page, "bug", titles.bug);
  await page.getByTestId("feedback-record").click();
  await page.getByTestId("recording-pill").waitFor();
  await settled(page);
  await shot(page, "pill-over-game");
});
