import { expect, test, type Page } from "@playwright/test";
import { savedStats } from "./games";
import { audioNow, clipOnCard, openListen, playedToTheEnd } from "./listen";
import { answer, answerWrong, leaveAsks, options, rightIndex } from "./quiz";

// گوش کن with the Ganjoor API, its audio and timing stubbed (./listen.ts): silence, so the clock of the audio is what is tested.

const toasts = (page: Page) => page.getByRole("region", { name: "اعلان‌ها" });

test.describe("گوش کن", () => {
  test("nothing plays before a press; play starts the clip at its start and it stops at its end, before the second hemistich; replay plays it again once", async ({ page }) => {
    await page.addInitScript(() => {
      // What the page asks of the audio clock: the volume is full, then ramps to nothing over the fade.
      const ramps: [string, number, number][] = [];
      (window as unknown as { __ramps: typeof ramps }).__ramps = ramps;
      for (const method of ["setValueAtTime", "linearRampToValueAtTime"] as const) {
        const original = AudioParam.prototype[method];
        AudioParam.prototype[method] = function (value: number, time: number) {
          ramps.push([method, value, time]);
          return original.call(this, value, time);
        };
      }
    });
    await openListen(page, "measured");
    const clip = await clipOnCard(page);
    expect(clip.fade).toBe(0.08); // measured in the real audio
    await expect(page.getByTestId("listen-card")).toHaveAttribute("data-state", "idle");
    await expect(page.getByTestId("listen-card")).toContainText("متن رو نمی‌بینی، فقط می‌شنوی");
    expect(await audioNow(page)).toBeUndefined(); // a browser lets sound start after a gesture

    await page.getByRole("button", { name: "پخش" }).click();
    await expect.poll(async () => (await audioNow(page))?.time ?? 0).toBeGreaterThanOrEqual(clip.start);
    expect((await audioNow(page))!.time).toBeLessThan(clip.start + 1.5);
    await expect(page.getByRole("button", { name: "مکث" })).toBeVisible();
    const stopped = await playedToTheEnd(page);
    const ramps = await page.evaluate(() => (window as unknown as { __ramps: [string, number, number][] }).__ramps);
    const down = ramps.findLast(([method]) => method === "linearRampToValueAtTime")!;
    const full = ramps.findLast(([method, value, time]) => method === "setValueAtTime" && value === 1 && time < down[2] - 0.01)!;
    expect(down[1]).toBe(0);
    expect(down[2] - full[2]).toBeCloseTo(clip.fade, 1); // the volume falls over the fade, on the audio clock
    expect(stopped.paused).toBe(true);
    expect(stopped.time).toBeLessThanOrEqual(clip.end + 0.1);
    expect(stopped.time).toBeGreaterThan(clip.end - 0.5);

    const replay = page.getByRole("button", { name: "دوباره بشنو (۱)" });
    await replay.click();
    await expect(page.getByRole("button", { name: "دوباره بشنو (۰)" })).toBeDisabled();
    await expect(page.getByTestId("listen-card")).toHaveAttribute("data-state", /loading|playing/);
    expect((await audioNow(page))!.time).toBeLessThan(clip.start + 1.5);
    expect((await playedToTheEnd(page)).time).toBeLessThanOrEqual(clip.end + 0.1);
  });

  test("a clip whose end was not measured stops before the second hemistich's mark, with the longer fade", async ({ page }) => {
    await openListen(page, "margin");
    const clip = await clipOnCard(page);
    expect(clip.fade).toBe(0.25);
    expect(clip.end - clip.start).toBeCloseTo(6 - 0.8, 2); // the next hemistich is marked six seconds on
    await page.getByRole("button", { name: "پخش" }).click();
    expect((await playedToTheEnd(page)).time).toBeLessThanOrEqual(clip.end + 0.1);
  });

  test("pause and play go on from where it was", async ({ page }) => {
    await openListen(page, "measured");
    await page.getByRole("button", { name: "پخش" }).click();
    await expect(page.getByRole("button", { name: "مکث" })).toBeVisible();
    await page.getByRole("button", { name: "مکث" }).click();
    await expect(page.getByTestId("listen-card")).toHaveAttribute("data-state", "paused");
    const paused = (await audioNow(page))!;
    expect(paused.paused).toBe(true);
    await page.waitForTimeout(600);
    expect((await audioNow(page))!.time).toBe(paused.time);
    await page.getByRole("button", { name: "پخش" }).click();
    await expect.poll(async () => (await audioNow(page))!.time).toBeGreaterThan(paused.time);
  });

  test("a right answer is green and gives 20 whatever the time; a wrong one is red and gives nothing; the next question's clip starts by itself", async ({ page }) => {
    await openListen(page, "measured");
    const first = await clipOnCard(page);
    await page.getByRole("button", { name: "پخش" }).click();
    await expect(page.getByRole("button", { name: "مکث" })).toBeVisible();
    const right = await rightIndex(page, "listen");
    await answer(page, right);
    expect((await audioNow(page))!.paused).toBe(true); // the answer stops the clip
    await expect(options(page).nth(right)).toHaveAttribute("data-state", "right");
    await expect(page.getByTestId("verdict")).toHaveText("آره، همینه!");
    await expect(page.getByTestId("answer-sheet")).toContainText("+۲۰");
    await expect(page.getByTestId("score")).toHaveText("+۲۰");
    expect((await savedStats(page)).points).toBe(20);

    await page.getByTestId("next").click();
    await expect(page.getByTestId("listen-card")).toBeVisible();
    const second = await clipOnCard(page);
    expect(second.start === first.start && second.end === first.end).toBe(false);
    await expect.poll(async () => (await audioNow(page))?.paused).toBe(false); // a press has been given once, so no more
    expect((await audioNow(page))!.time).toBeGreaterThanOrEqual(second.start);
    await playedToTheEnd(page);

    const wrong = await answerWrong(page, "listen");
    await expect(options(page).nth(wrong === 0 ? 1 : 0)).toHaveAttribute("data-state", "wrong");
    await expect(options(page).nth(wrong)).toHaveAttribute("data-state", "right");
    await expect(page.getByTestId("answer-sheet")).toContainText("نه، این بود");
    await expect(page.getByTestId("correction")).toBeVisible();
    await expect(page.getByTestId("score")).toHaveText("+۲۰");
  });

  test("«یه کلمه» marks a word of the right option for 20 points", async ({ page }) => {
    await openListen(page, "measured");
    await expect(page.getByTestId("listen-card")).toBeVisible();
    await page.getByRole("button", { name: "یه کلمه، ۲۰ امتیاز" }).click();
    await expect(page.getByTestId("hint-word")).toHaveCount(1);
    await expect(options(page).nth(await rightIndex(page, "listen")).getByTestId("hint-word")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "یه کلمه، ۲۰ امتیاز" })).toBeDisabled();
    await answer(page, await rightIndex(page, "listen"));
    await expect(page.getByTestId("score")).toHaveText("+۰");
  });

  test("a round is five questions and ends with the round-end screen", async ({ page }) => {
    test.setTimeout(90_000);
    await openListen(page, "measured");
    for (let index = 0; index < 5; index++) {
      await expect(page.getByTestId("listen-card")).toBeVisible();
      await answer(page, await rightIndex(page, "listen"));
      await page.getByTestId("next").click();
    }
    await expect(page.getByTestId("round-end")).toBeVisible();
    await expect(page.getByTestId("round-end-score")).toHaveAccessibleName("۵ از ۵");
    expect((await savedStats(page)).best?.listen).toBe(100);
  });

  test("leaving asks only once a question has been answered", async ({ page }) => {
    await openListen(page, "measured");
    await expect(page.getByTestId("listen-card")).toBeVisible();
    await answer(page, await rightIndex(page, "listen"));
    await page.getByTestId("next").click();
    await leaveAsks(page);
  });

  test("skipping the last question ends the round with no sound left playing", async ({ page }) => {
    test.setTimeout(60_000);
    await openListen(page, "measured");
    await page.getByRole("button", { name: "پخش" }).click();
    for (let index = 0; index < 4; index++) {
      await expect(page.getByTestId("listen-card")).toHaveAttribute("data-state", /loading|playing/);
      await page.getByTestId("skip").click();
    }
    await expect(page.getByTestId("listen-card")).toHaveAttribute("data-state", /loading|playing/); // the fifth clip is playing
    expect((await audioNow(page))!.paused).toBe(false);
    await page.getByTestId("skip").click();
    await expect(page.getByTestId("round-end")).toBeVisible();
    // Short, so a clip that ends by itself in a few seconds does not pass for one that was stopped.
    await expect.poll(async () => (await audioNow(page))!.paused, { timeout: 1000 }).toBe(true);
    await page.waitForTimeout(1500);
    expect((await audioNow(page))!.paused).toBe(true);
  });

  test("a round that can't be made (the poems won't load) says so and offers «دوباره», which tries again", async ({ page }) => {
    await page.route("**/data/poets.json", (route) => route.abort());
    await openListen(page, "measured");
    const alert = page.getByRole("alert").filter({ hasText: "بازی باز نشد" });
    await expect(alert).toBeVisible();
    await expect(page.getByRole("button", { name: "بستن" })).toBeVisible(); // and a way out
    await page.unroute("**/data/poets.json");
    await alert.getByRole("button", { name: "دوباره" }).click();
    await expect(page.getByTestId("listen-card")).toBeVisible();
  });

  test("audio that does not load says «خوانش باز نشد» and goes back to the tab", async ({ page }) => {
    await openListen(page, "broken");
    await page.getByRole("button", { name: "پخش" }).click();
    await expect(toasts(page).getByText("خوانش باز نشد")).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === "/games", { timeout: 6000 });
  });

  test("no recitation at all says «خوانش باز نشد» and goes back to the tab", async ({ page }) => {
    await openListen(page, "none");
    await expect(toasts(page).getByText("خوانش باز نشد")).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === "/games", { timeout: 6000 });
  });
});
