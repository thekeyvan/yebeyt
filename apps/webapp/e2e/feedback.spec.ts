import { expect, test, type Page } from "@playwright/test";
import { openApp } from "./browse";
import { openSignedIn, expectRightToLeftAndFits } from "./friends";
import { openMe, openSettings, toasts } from "./me";
import { chatTexts } from "./messages";
import { choices, feedbackServer, form, inspect, openByKeyboard, openForm, thumbnail, titles } from "./feedback";

const sara = "/messages/sara.ghazal";
const wide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;
const thanks = (page: Page) => toasts(page).getByText("رسید، ممنون!");
const asking = (page: Page, title = "بازخوردت هنوز فرستاده نشده. ولش کنی؟") => page.getByRole("dialog", { name: title });

/** The fake recorder of a debug build (`sessionStorage.beytFakeRecorder`, the phone's `-beytFakeRecorder 1`): it starts with no prompt and keeps a tiny MP4. */
const fakeRecorder = (page: Page) => page.addInitScript(() => sessionStorage.setItem("beytFakeRecorder", "1"));

/** What the page puts on top of everything is what is at the middle of the pill. */
const pillOnTop = (page: Page) =>
  page.evaluate(() => {
    const box = document.querySelector("[data-testid=recording-stop]")!.getBoundingClientRect();
    return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest("[data-testid=recording-stop]") !== null;
  });

test.describe("opening", () => {
  test("the settings row opens the choices: five types in the board's order, the game one marked new; Escape closes", async ({ page }) => {
    await openMe(page, "/");
    await openSettings(page);
    await page.getByTestId("settings-feedback").click();
    await expect(choices(page)).toBeVisible();
    await expect(choices(page)).toContainText("هر چی تو ذهنته بگو، همه‌ش رو خودمون می‌خونیم.");
    const rows = page.locator("[data-testid^=feedback-type-]");
    expect(await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid")))).toEqual(["bug", "idea", "game", "liked", "annoyed"].map((type) => `feedback-type-${type}`));
    await expect(page.getByTestId("feedback-type-bug")).toContainText("باگ دیدم");
    await expect(page.getByTestId("feedback-type-bug")).toContainText("یه چیزی درست کار نمی‌کنه");
    await expect(page.getByTestId("feedback-type-game")).toContainText("تازه");
    await expect(page.getByTestId("feedback-type-game")).toContainText("بازی‌ای که دلت می‌خواد توی «یه بیت» باشه");
    await expect(page.getByTestId("feedback-type-annoyed")).not.toContainText("تازه");
    // The shortcut is told to a keyboard, and not to a phone.
    const keyboard = await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches);
    expect(keyboard).toBe(wide(page));
    await expect(page.getByTestId("feedback-shortcut-note")).toHaveCount(keyboard ? 1 : 0);
    await expectRightToLeftAndFits(page);
    await page.keyboard.press("Escape");
    await expect(choices(page)).toBeHidden();
  });

  test("Shift and «?» open it from anywhere, except while typing in a field", async ({ page }) => {
    await openApp(page, "/explore/search");
    const field = page.locator("input").first();
    await field.focus();
    await page.keyboard.type("?");
    await expect(field).toHaveValue("?");
    await expect(choices(page)).toHaveCount(0);
    await field.blur();
    await page.locator("main").click({ position: { x: 4, y: 4 } });
    await openByKeyboard(page);
    await page.keyboard.press("Escape");
    await expect(choices(page)).toBeHidden();
    await openApp(page, "/");
    await openByKeyboard(page);
  });
});

test.describe("the forms", () => {
  test("a bug: the text, how often, the screenshot with its switch, and the technical info that shows exactly what is sent", async ({ page }) => {
    await openMe(page, "/");
    await openSettings(page);
    await openForm(page, "bug", titles.bug);
    const dialog = form(page, titles.bug);
    await expect(dialog.getByText("چی شد؟", { exact: true })).toBeVisible();
    await expect(dialog.getByText("چند بار پیش اومده؟")).toBeVisible();
    for (const label of ["همیشه", "گاهی", "یه بار"]) await expect(dialog.getByRole("radio", { name: label })).toBeVisible();
    await expect(dialog.getByRole("radio", { name: "گاهی" })).toBeChecked();
    await expect(dialog.getByText("از همون لحظه همراهش می‌فرستیم")).toBeVisible();
    await expect(page.getByTestId("feedback-thumbnail")).toBeVisible();
    await expect(page.getByTestId("feedback-screenshot-switch")).toHaveAttribute("aria-checked", "true");
    await expect(dialog.getByText("چیزی که جای دیگه تایپ کردی یا پیام‌هات هیچ‌وقت همراهش نمیاد. عکس صفحه رو خودت تصمیم می‌گیری.")).toBeVisible();
    await expect(page.getByTestId("feedback-send")).toBeDisabled();
    await page.getByTestId("feedback-text").fill("   ");
    await expect(page.getByTestId("feedback-send")).toBeDisabled();
    await page.getByTestId("feedback-text").fill("یه چیزی درست کار نکرد");
    await expect(page.getByTestId("feedback-send")).toBeEnabled();
    await page.getByTestId("feedback-technical-toggle").click();
    const rows = page.getByTestId("feedback-technical-rows");
    await expect(rows).toContainText("تنظیمات");
    for (const label of ["صفحه", "اینترنت", "حساب", "متن · اندازه", "کارهای قبلش"]) await expect(rows).toContainText(label);
    await expect(rows).not.toContainText("یه چیزی درست کار نکرد");
    await expectRightToLeftAndFits(page);
  });

  test("an annoying thing has the screenshot (on) and no technical info; an idea has it off; thanks and a game idea have none", async ({ page }) => {
    await openApp(page, "/");
    await openForm(page, "annoyed", titles.annoyed);
    await expect(page.getByTestId("feedback-screenshot-switch")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("feedback-technical-toggle")).toHaveCount(0);
    await expect(page.getByTestId("feedback-text")).toHaveAttribute("placeholder", "بنویس…");
    await page.keyboard.press("Escape");
    await expect(form(page, titles.annoyed)).toBeHidden();
    await openForm(page, "idea", titles.idea);
    await expect(page.getByTestId("feedback-screenshot-switch")).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press("Escape");
    await expect(form(page, titles.idea)).toBeHidden();
    await openForm(page, "liked", titles.liked);
    await expect(page.getByTestId("feedback-thumbnail")).toHaveCount(0);
    await expect(page.getByText("از همون لحظه همراهش می‌فرستیم")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(form(page, titles.liked)).toBeHidden();
    await openForm(page, "game", titles.game);
    const dialog = form(page, titles.game);
    await expect(dialog.getByText("اسمش")).toBeVisible();
    await expect(dialog.getByText("اگه داره")).toBeVisible();
    await expect(page.getByTestId("feedback-game-name")).toHaveAttribute("placeholder", "مثلاً «بیت عوضی»");
    await expect(dialog.getByText("چطوری بازی می‌شه؟")).toBeVisible();
    await expect(dialog.getByText("با کی بازی می‌شه؟")).toBeVisible();
    await expect(dialog.getByRole("radio", { name: "تنها" })).toBeChecked();
    await expect(page.getByTestId("feedback-account-note")).toHaveText("بدون حساب هم می‌شه فرستاد. اگه وارد شده باشی، نام کاربریت هم میاد تا بتونیم جوابت رو بدیم.");
    await expect(page.getByTestId("feedback-thumbnail")).toHaveCount(0);
    await expectRightToLeftAndFits(page);
  });
});

test.describe("sending", () => {
  test("a bug from inside a chat goes with a picture of the chat and nothing that was said in it", async ({ page }) => {
    const server = await feedbackServer(page);
    await openSignedIn(page, sara);
    await expect(page.getByTestId("bubble-m3")).toBeVisible();
    await openForm(page, "bug", titles.bug);
    await expect(page.getByTestId("feedback-thumbnail")).toBeVisible();
    await page.getByTestId("feedback-text").fill("پیام نمی‌رسه");
    await page.getByRole("radio", { name: "همیشه" }).click();
    await page.getByTestId("feedback-technical-toggle").click();
    await expect(page.getByTestId("feedback-technical-rows")).toContainText("گفتگو");
    await page.getByTestId("feedback-send").click();
    await expect(thanks(page)).toBeVisible();
    await expect(form(page, titles.bug)).toBeHidden();

    const report = server.json();
    expect(report).toMatchObject({ type: "bug", text: "پیام نمی‌رسه", frequency: "always", screen: "گفتگو" });
    expect(Object.keys(report).sort()).toEqual(["appVersion", "deviceModel", "frequency", "osVersion", "screen", "technical", "text", "type"]);
    const technical = report.technical as { screen: string; steps: string[]; accountState: string; network: string };
    expect(technical).toMatchObject({ screen: "گفتگو", accountState: "signedIn" });
    expect(technical.steps).toContain("گفتگو");
    expect(String(report.deviceModel)).toMatch(/·/);

    const [shot] = server.uploads("screenshot");
    expect(server.uploads("screenshot")).toHaveLength(1);
    expect([shot!.method, shot!.type, shot!.token]).toEqual(["PUT", "image/jpeg", "tok_1-A"]);
    expect([...shot!.body.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    const picture = await inspect(page, shot!.body);
    expect(picture.width).toBeGreaterThan(300);
    expect(Math.max(picture.width, picture.height)).toBeLessThanOrEqual(1600);
    expect(picture.colours, "the picture is not empty").toBeGreaterThan(12);
    expect(server.uploads("recording")).toHaveLength(0);

    const everything = server.seen.map((call) => call.body.toString("latin1") + call.body.toString("utf8")).join("\n");
    for (const text of chatTexts) expect(everything, text).not.toContain(text);
  });

  test("a guest's report goes without the session, as a text and nothing else when the type takes no screenshot", async ({ page }) => {
    const server = await feedbackServer(page);
    await openApp(page, "/");
    await openForm(page, "liked", titles.liked);
    await page.getByTestId("feedback-text").fill("خیلی خوبه");
    await page.getByTestId("feedback-send").click();
    await expect(thanks(page)).toBeVisible();
    expect(server.json()).toMatchObject({ type: "liked", text: "خیلی خوبه" });
    expect(Object.keys(server.json()).sort()).toEqual(["appVersion", "deviceModel", "osVersion", "text", "type"]);
    expect(server.uploads("screenshot")).toHaveLength(0);
  });

  test("turning the screenshot off takes it off the report", async ({ page }) => {
    const server = await feedbackServer(page);
    await openApp(page, "/");
    await openForm(page, "annoyed", titles.annoyed);
    await page.getByTestId("feedback-text").fill("چیزی که اذیتم کرد");
    await page.getByTestId("feedback-screenshot-switch").click();
    await expect(page.getByTestId("feedback-screenshot-switch")).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("feedback-edit")).toBeDisabled();
    await page.getByTestId("feedback-send").click();
    await expect(thanks(page)).toBeVisible();
    expect(server.json()).toMatchObject({ type: "annoyed", screen: "خونه" });
    expect(server.uploads("screenshot")).toHaveLength(0);
  });

  test("the editor: a box drawn over the picture is in the picture that is sent, and marks count as something unsent", async ({ page }) => {
    const server = await feedbackServer(page);
    await openApp(page, "/");
    await openForm(page, "bug", titles.bug);
    const before = await thumbnail(page);
    await page.getByTestId("feedback-edit").click();
    const editor = page.getByRole("dialog", { name: "خط بکش یا بپوشون" });
    await expect(editor).toBeVisible();
    await expect(page.getByTestId("editor-undo")).toBeDisabled();
    await editor.getByText("بپوشون", { exact: true }).click();
    const canvas = page.getByTestId("editor-picture");
    await expect(canvas).toBeVisible();
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4, { steps: 4 });
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByTestId("editor-undo")).toBeEnabled();
    await page.getByTestId("editor-done").click();
    await expect(editor).toBeHidden();
    await expect.poll(async () => (await thumbnail(page)).equals(before)).toBe(false);
    // Marks are work: closing the form asks.
    await page.getByTestId("feedback-close").click();
    await expect(asking(page)).toBeVisible();
    await asking(page).getByRole("button", { name: "بمون" }).click();
    await expect(asking(page)).toBeHidden();
    await page.getByTestId("feedback-text").fill("باگ");
    await page.getByTestId("feedback-send").click();
    await expect(thanks(page)).toBeVisible();
    const [shot] = server.uploads("screenshot");
    const picture = await inspect(page, shot!.body, [[0.5, 0.4]]);
    expect(picture.pixels[0]!.every((channel) => channel < 90), `the middle of the box is ink: ${picture.pixels[0]}`).toBe(true);
  });

  test("closing a form with something written asks first; «بمون» keeps it, «ول کن» drops it, and an empty form closes at once", async ({ page }) => {
    const server = await feedbackServer(page);
    await openApp(page, "/");
    await openForm(page, "idea", titles.idea);
    await page.getByTestId("feedback-close").click();
    await expect(form(page, titles.idea)).toBeHidden();
    await expect(asking(page)).toHaveCount(0);
    await openForm(page, "idea", titles.idea);
    await page.getByTestId("feedback-text").fill("   ");
    await page.getByTestId("feedback-close").click();
    await expect(form(page, titles.idea)).toBeHidden();
    await openForm(page, "idea", titles.idea);
    await page.getByTestId("feedback-text").fill("یه ایده");
    await page.getByTestId("feedback-close").click();
    await expect(asking(page)).toBeVisible();
    await expect(asking(page).getByRole("button", { name: "ول کن" })).toBeVisible();
    await asking(page).getByRole("button", { name: "بمون" }).click();
    await expect(asking(page)).toBeHidden();
    await expect(page.getByTestId("feedback-text")).toHaveValue("یه ایده");
    await page.keyboard.press("Escape"); // the keys and the swipe ask too
    await expect(asking(page)).toBeVisible();
    await asking(page).getByRole("button", { name: "ول کن" }).click();
    await expect(form(page, titles.idea)).toBeHidden();
    await expect(asking(page)).toBeHidden();
    expect(server.seen).toEqual([]);
    await openByKeyboard(page); // and it can open again, with nothing left of the draft
    await page.getByTestId("feedback-type-idea").click();
    await expect(page.getByTestId("feedback-text")).toHaveValue("");
  });

  test("offline keeps the draft with the offline line, and sending again later works; too many reports says to wait", async ({ page }) => {
    const server = await feedbackServer(page, { report: "offline" });
    await openApp(page, "/");
    await openForm(page, "idea", titles.idea);
    await page.getByTestId("feedback-text").fill("یه ایده");
    await page.getByTestId("feedback-send").click();
    await expect(page.getByTestId("feedback-failure")).toHaveText("الان نرسید، وقتی اینترنت اومد دوباره بفرست");
    await expect(page.getByTestId("feedback-text")).toHaveValue("یه ایده");
    await expect(page.getByTestId("feedback-send")).toBeEnabled();
    server.behaviour.report = "rate";
    await page.getByTestId("feedback-send").click();
    await expect(page.getByTestId("feedback-failure")).toHaveText("یه کم بعد دوباره بفرست");
    server.behaviour.report = "broken";
    await page.getByTestId("feedback-send").click();
    await expect(page.getByTestId("feedback-failure")).toHaveText("یه مشکلی پیش اومد؛ یه بار دیگه امتحان کن.");
    server.behaviour.report = "ok";
    await page.getByTestId("feedback-send").click();
    await expect(thanks(page)).toBeVisible();
    await expect(form(page, titles.idea)).toBeHidden();
    expect(server.reports()).toHaveLength(4);
  });

  test("when the report arrived and a file did not, it is not made twice, the form is locked, and closing says the file did not go", async ({ page }) => {
    const server = await feedbackServer(page, { upload: "busy" });
    await openApp(page, "/");
    await openForm(page, "annoyed", titles.annoyed);
    await page.getByTestId("feedback-text").fill("یه چیزی");
    await page.getByTestId("feedback-send").click();
    await expect(page.getByTestId("feedback-failure")).toHaveText("الان سرور شلوغه؛ یه کم بعد دوباره بفرست");
    await expect(page.getByTestId("feedback-text")).toBeDisabled();
    await page.getByTestId("feedback-close").click();
    await expect(asking(page, "فیلم یا عکست فرستاده نشده. ولش کنی؟")).toBeVisible();
    await asking(page, "فیلم یا عکست فرستاده نشده. ولش کنی؟").getByRole("button", { name: "بمون" }).click();
    await expect(asking(page, "فیلم یا عکست فرستاده نشده. ولش کنی؟")).toBeHidden();
    server.behaviour.upload = "ok";
    await page.getByTestId("feedback-send").click();
    await expect(thanks(page)).toBeVisible();
    expect(server.reports()).toHaveLength(1);
    expect(server.uploads("screenshot")).toHaveLength(3);
  });

  test("a file the server refuses for good does not hold the report back", async ({ page }) => {
    await feedbackServer(page, { upload: "too-big" });
    await openApp(page, "/");
    await openForm(page, "annoyed", titles.annoyed);
    await page.getByTestId("feedback-text").fill("یه چیزی");
    await page.getByTestId("feedback-send").click();
    await expect(thanks(page)).toBeVisible();
  });
});

test.describe("what is private", () => {
  test("the private views and the fields are blocks in the picture, and it is the same picture whatever they said", async ({ page }) => {
    await feedbackServer(page);
    await openApp(page, "/");
    const probe = (secret: string, open: string) =>
      page.evaluate(
        ([hidden, shown]) => {
          document.getElementById("probe")?.remove();
          const wrap = document.createElement("div");
          wrap.id = "probe";
          wrap.style.cssText = "position:fixed;top:120px;left:10px;z-index:30;width:320px;display:flex;flex-direction:column;gap:6px";
          const line = "width:300px;height:40px;overflow:hidden;background:#fff;color:#000;font-size:28px";
          const message = Object.assign(document.createElement("div"), { textContent: hidden });
          message.setAttribute("data-feedback-private", "");
          message.setAttribute("style", line);
          message.id = "message";
          const typed = Object.assign(document.createElement("input"), { value: hidden });
          typed.setAttribute("style", `${line};border:0`);
          typed.id = "typed";
          const plain = Object.assign(document.createElement("div"), { textContent: shown });
          plain.setAttribute("style", line);
          wrap.append(message, typed, plain);
          document.body.append(wrap);
        },
        [secret, open],
      );
    const take = async () => {
      await openByKeyboard(page);
      await page.getByTestId("feedback-type-annoyed").click();
      const picture = await thumbnail(page);
      await page.getByTestId("feedback-close").click();
      await expect(form(page, titles.annoyed)).toBeHidden();
      return picture;
    };
    await probe("رمز اول: سلام", "نوشته‌ی عمومی");
    await take(); // the page has settled (nothing is still sliding in) by the second picture
    const first = await take();
    await probe("رمز دوم: خداحافظ", "نوشته‌ی عمومی");
    const second = await take();
    await probe("رمز دوم: خداحافظ", "یه نوشته‌ی دیگه");
    const third = await take();
    expect(first.equals(second), "a different secret, the same picture").toBe(true);
    expect(second.equals(third), "a different plain text, another picture").toBe(false);

    const where = await page.evaluate(() => {
      const view = { width: document.documentElement.clientWidth, height: window.innerHeight };
      const centre = (id: string) => {
        const box = document.getElementById(id)!.getBoundingClientRect();
        return [(box.x + box.width / 2) / view.width, (box.y + box.height / 2) / view.height] as [number, number];
      };
      return [centre("message"), centre("typed")];
    });
    const picture = await inspect(page, first, where);
    expect(picture.pixels, "the track colour #E6E3EC, a block").toEqual([[230, 227, 236], [230, 227, 236]]);
  });
});

test.describe("in a game", () => {
  test("the game idea can be sent from inside a game: the sheet comes over the game, and the report has the game and no screenshot", async ({ page }) => {
    const server = await feedbackServer(page);
    await openApp(page, "/games/daily");
    await expect(page.getByTestId("game")).toBeVisible();
    await openByKeyboard(page);
    await page.getByTestId("feedback-type-game").click();
    const dialog = form(page, titles.game);
    await expect(dialog).toBeVisible();
    await page.getByTestId("feedback-game-name").fill("بیت عوضی");
    await page.getByTestId("feedback-text").fill("بیت‌ها قاطی می‌شن و باید جاشون رو پیدا کنی");
    await dialog.getByText("هر دو", { exact: true }).click();
    await page.getByTestId("feedback-send").click();
    await expect(thanks(page)).toBeVisible();
    expect(server.json()).toEqual({
      type: "game",
      game: { name: "بیت عوضی", how: "بیت‌ها قاطی می‌شن و باید جاشون رو پیدا کنی", players: "both" },
      appVersion: expect.any(String),
      deviceModel: expect.any(String),
      osVersion: expect.any(String),
    });
    expect(server.uploads("screenshot")).toHaveLength(0);
    await expect(page.getByTestId("game")).toBeVisible(); // the game is still there
  });

  test("the recording pill is above the game; «تموم» stops it and the recording is attached and uploaded", async ({ page }) => {
    await fakeRecorder(page);
    const server = await feedbackServer(page);
    await openApp(page, "/games/daily");
    await expect(page.getByTestId("game")).toBeVisible();
    await openForm(page, "bug", titles.bug);
    await page.getByTestId("feedback-text").fill("بازی گیر کرد");
    await page.getByTestId("feedback-record").click();
    await expect(form(page, titles.bug)).toBeHidden();
    await expect(page.getByTestId("recording-pill")).toContainText("در حال ضبط");
    await expect(page.getByTestId("recording-pill")).toContainText("تموم");
    expect(await pillOnTop(page)).toBe(true);
    await expect(page.getByTestId("game")).toBeVisible();
    await page.getByTestId("recording-stop").click();
    await expect(page.getByTestId("recording-pill")).toHaveCount(0);
    await expect(form(page, titles.bug)).toBeVisible();
    await expect(page.getByTestId("feedback-text")).toHaveValue("بازی گیر کرد");
    await expect(page.getByTestId("feedback-recorded")).toContainText("فیلم ضبط شد · ");
    await page.getByTestId("feedback-send").click();
    await expect(thanks(page)).toBeVisible();
    const [film] = server.uploads("recording");
    expect(server.uploads("recording")).toHaveLength(1);
    expect([film!.type, film!.token]).toEqual(["video/mp4", "tok_1-A"]);
    expect(film!.body.length).toBeGreaterThan(8);
    expect(film!.body.subarray(4, 8).toString("latin1")).toBe("ftyp");
    expect(server.uploads("screenshot")).toHaveLength(1);
    expect(server.seen.map((call) => `${call.method} ${call.path}`)).toEqual(["POST /api/v1/feedback", "PUT /api/v1/feedback/<id>/screenshot", "PUT /api/v1/feedback/<id>/recording"]);
  });

  test("a recording can be deleted after asking, and a second one replaces the first", async ({ page }) => {
    await fakeRecorder(page);
    const server = await feedbackServer(page);
    await openApp(page, "/");
    await openForm(page, "bug", titles.bug);
    await page.getByTestId("feedback-record").click();
    await page.getByTestId("recording-stop").click();
    await expect(page.getByTestId("feedback-recorded")).toBeVisible();
    await page.getByTestId("feedback-remove-recording").click();
    await expect(asking(page, "فیلم پاک بشه؟")).toBeVisible();
    await asking(page, "فیلم پاک بشه؟").getByRole("button", { name: "نه" }).click();
    await expect(asking(page, "فیلم پاک بشه؟")).toBeHidden();
    await expect(page.getByTestId("feedback-recorded")).toBeVisible();
    await page.getByTestId("feedback-remove-recording").click();
    await asking(page, "فیلم پاک بشه؟").getByRole("button", { name: "پاک کن" }).click();
    await expect(page.getByTestId("feedback-recorded")).toHaveCount(0);
    await expect(page.getByTestId("feedback-record")).toBeVisible();
    await page.getByTestId("feedback-text").fill("بدون فیلم");
    await page.getByTestId("feedback-send").click();
    await expect(thanks(page)).toBeVisible();
    expect(server.uploads("recording")).toHaveLength(0);
  });

  test("the private views are covered while recording, kept on them as the page scrolls, and uncovered after", async ({ page }) => {
    await fakeRecorder(page);
    await feedbackServer(page);
    await openSignedIn(page, sara);
    await expect(page.getByTestId("bubble-m3")).toBeVisible();
    await openForm(page, "bug", titles.bug);
    await page.getByTestId("feedback-record").click();
    await expect(page.getByTestId("recording-pill")).toBeVisible();
    const uncovered = () =>
      page.evaluate(() => {
        const covers = [...document.querySelectorAll("[data-testid=feedback-cover]")].map((cover) => cover.getBoundingClientRect());
        const inView = [...document.querySelectorAll("[data-feedback-private]")]
          .map((element) => element.getBoundingClientRect())
          .filter((box) => box.width > 0 && box.height > 0 && box.top >= 140 && box.bottom <= innerHeight - 150 && box.left >= 0 && box.right <= innerWidth);
        const missing = inView.filter((box) => !covers.some((cover) => Math.abs(cover.x - box.x) < 2 && Math.abs(cover.y - box.y) < 2 && Math.abs(cover.width - box.width) < 2 && Math.abs(cover.height - box.height) < 2));
        return { covers: covers.length, inView: inView.length, missing: missing.length };
      });
    await expect.poll(uncovered).toMatchObject({ missing: 0 });
    expect((await uncovered()).inView).toBeGreaterThan(0);
    expect((await page.getByTestId("feedback-cover").count())).toBeGreaterThan(0);
    await page.evaluate(() => window.scrollBy(0, 70));
    await expect.poll(uncovered).toMatchObject({ missing: 0 });
    await page.getByTestId("recording-stop").click();
    await expect(page.getByTestId("feedback-cover")).toHaveCount(0);
  });

  test("the pill stays live over a sheet that opens under it", async ({ page }) => {
    await fakeRecorder(page);
    await feedbackServer(page);
    await openMe(page, "/");
    await openSettings(page);
    await openByKeyboard(page);
    await page.getByTestId("feedback-type-bug").click();
    await page.getByTestId("feedback-record").click();
    await expect(page.getByTestId("recording-pill")).toBeVisible();
    await expect(form(page, titles.bug)).toBeHidden(); // the sheet has gone: what is pressed next is not a press outside it
    await page.getByTestId("settings-text").click();
    await expect(page.getByRole("dialog", { name: "متن" })).toBeVisible();
    expect(await pillOnTop(page)).toBe(true);
    await page.getByTestId("recording-stop").click();
    await expect(page.getByTestId("recording-pill")).toHaveCount(0);
  });

  test("a browser that can't share the screen has no recording option", async ({ page }) => {
    await page.addInitScript(() => {
      const devices = navigator.mediaDevices;
      if (devices) delete (Object.getPrototypeOf(devices) as { getDisplayMedia?: unknown }).getDisplayMedia;
      Object.defineProperty(devices ?? navigator, "getDisplayMedia", { value: undefined, configurable: true });
    });
    await openApp(page, "/");
    await openForm(page, "bug", titles.bug);
    await expect(page.getByTestId("feedback-text")).toBeVisible();
    await expect(page.getByTestId("feedback-record")).toHaveCount(0);
    await expect(page.getByText("دوباره انجامش بده، ما فیلم می‌گیریم")).toHaveCount(0);
  });
});
