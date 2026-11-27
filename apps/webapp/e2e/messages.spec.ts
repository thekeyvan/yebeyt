import { expect, test } from "@playwright/test";
import { expectReader, tabBar } from "./browse";
import { openAccountApp } from "./account";
import { asked, expectRightToLeftAndFits, openSignedIn } from "./friends";
import { toasts } from "./me";
import { endsClearOfTabs, expectAllPrivate, fakeLive, messagesTab, serverUnread } from "./messages";

const gate = (page: import("@playwright/test").Page) => page.getByRole("dialog", { name: /یه حساب لازمه/ });
const wide = (page: import("@playwright/test").Page) => (page.viewportSize()?.width ?? 0) >= 1024;

const sara = "/messages/sara.ghazal";

test.describe("the inbox", () => {
  test("lists the five chats newest first with their previews, the dots of what is unread and the requests row; the tab bar's badge adds it all up", async ({ page }) => {
    await openSignedIn(page, "/messages");
    await expectRightToLeftAndFits(page);
    await expect(page.getByRole("heading", { name: "پیام‌ها" })).toBeVisible();
    const rows = page.locator("[data-testid^=inbox-row-]");
    await expect(rows).toHaveCount(5);
    expect(await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid")))).toEqual(["inbox-row-sara.ghazal", "inbox-row-aryan", "inbox-row-kian_k", "inbox-row-mahsa.m", "inbox-row-bardia"]);
    expect(await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-unread")))).toEqual(["1", "1", "0", "0", "0"]);
    const preview = (name: string) => page.getByTestId(`inbox-row-${name}`);
    await expect(preview("sara.ghazal")).toContainText("سارا");
    await expect(preview("sara.ghazal")).toContainText("دعوتت کرد به بازی");
    await expect(preview("kian_k")).toContainText("بیت قشنگی بود");
    await expect(preview("mahsa.m")).toContainText("تو: فردا معما رو با هم حل کنیم؟");
    await expect(preview("bardia")).toContainText("یه بیت فرستاد");
    await expect(page.getByTestId("unread-dot")).toHaveCount(2);
    await expect(page.getByTestId("requests-count")).toHaveText("۲");
    await expect(messagesTab(page)).toHaveAccessibleName("پیام‌ها ۲ پیام نخونده، ۲ درخواست دوستی");
    expect(await endsClearOfTabs(page, "[data-testid=inbox-list]")).toBe(true);
  });

  test("a search filters the rows by name or username; the compose button opens the people search, and a person opens their chat", async ({ page }) => {
    await openSignedIn(page, "/messages");
    const search = page.getByRole("searchbox", { name: "جستجو بین دوستات" });
    await search.fill("سار");
    await expect(page.locator("[data-testid^=inbox-row-]")).toHaveCount(1);
    await search.fill("kian");
    await expect(page.getByTestId("inbox-row-kian_k")).toBeVisible();
    await search.fill("هیچی");
    await expect(page.getByText("کسی با این اسم پیدا نشد.")).toBeVisible();
    await search.fill("");
    await page.getByTestId("inbox-compose").click();
    const sheet = page.getByRole("dialog", { name: "پیام تازه" });
    await sheet.getByRole("searchbox").fill("ma");
    await sheet.getByTestId("new-chat-mahsa.m").click();
    await expect(page).toHaveURL(/\/messages\/mahsa\.m$/);
    await expect(page.getByTestId("chat-name")).toHaveText("مهسا");
  });

  test("a guest gets the gate on the tab and on a chat", async ({ page }) => {
    await openAccountApp(page, "/messages");
    await expect(gate(page)).toBeVisible();
    await expect(gate(page)).toContainText("برای پیام دادن به دوستات");
    await gate(page).getByRole("button", { name: "بعداً" }).click();
    await expect(gate(page)).toHaveCount(0);
    await page.goto(sara);
    await expect(gate(page)).toBeVisible();
  });

  test("two panes from 1024 px: the inbox stays beside the chat; on a phone the chat takes the screen and the tab bar goes", async ({ page }) => {
    await openSignedIn(page, "/messages");
    if (wide(page)) await expect(page.getByTestId("empty-detail")).toBeVisible();
    await page.getByTestId("inbox-row-sara.ghazal").click();
    await expect(page).toHaveURL(/\/messages\/sara\.ghazal$/);
    await expect(page.getByTestId("chat-name")).toHaveText("سارا");
    if (wide(page)) {
      await expect(page.getByTestId("inbox-list")).toBeVisible();
      await expect(page.getByTestId("inbox-row-sara.ghazal")).toHaveAttribute("aria-current", "page");
      await page.getByTestId("inbox-row-kian_k").click();
      await expect(page.getByTestId("chat-name")).toHaveText("کیان");
      await expect(page.getByTestId("inbox-list")).toBeVisible();
      await expect(tabBar(page)).toBeVisible(); // the rail
      const inbox = (await page.getByTestId("inbox-list").boundingBox())!;
      const chat = (await page.getByTestId("chat").boundingBox())!;
      expect(inbox.x).toBeGreaterThan(chat.x); // right-to-left: the inbox is at the start, on the right
      expect(inbox.x).toBeGreaterThanOrEqual(chat.x + chat.width - 1);
    } else {
      await expect(page.getByTestId("inbox-list")).toBeHidden();
      await expect(tabBar(page)).toBeHidden();
    }
    await expectRightToLeftAndFits(page);
  });
});

test.describe("a chat", () => {
  test("Sara's: a couplet card with its note, my text «دیده شد», the game line and its button, and the quick actions", async ({ page }) => {
    await openSignedIn(page, sara);
    await expectRightToLeftAndFits(page);
    await expect(page.getByTestId("chat-name")).toHaveText("سارا");
    await expect(page.getByTestId("chat-status")).toHaveText("آنلاین · لیگ غزل‌باز");
    await expect(page.getByTestId("chat").getByTestId("online-dot")).toBeVisible();
    await expect(page.getByTestId("day-label")).toHaveText("امروز");
    await expect(page.getByTestId("couplet-message-m1")).toContainText("سارا یه بیت برات فرستاد");
    await expect(page.getByTestId("couplet-message-m1")).toContainText("اینو دیدم یاد تو افتادم");
    await expect(page.getByTestId("couplet-card-m1")).toContainText("حافظ");
    await expect(page.getByTestId("couplet-card-m1")).toContainText("کل شعر");
    await expect(page.getByTestId("couplet-card-m1")).toContainText("برای تو");
    await expect(page.getByTestId("bubble-m3")).toContainText("وای چقدر قشنگه! ممنون");
    await expect(page.getByTestId("bubble-m3")).toContainText("دیده شد");
    await expect(page.getByTestId("seen")).toHaveCount(1);
    await expect(page.getByTestId("game-card-g1")).toContainText("سارا دعوتت کرد به مشاعره");
    for (const chip of ["quick-couplet", "quick-mosh", "quick-duel", "quick-daily"]) await expect(page.getByTestId(chip)).toBeVisible();
    await page.getByTestId("game-go-g1").click(); // the games with friends come to the web later
    await expect(toasts(page)).toContainText("به‌زودی روی وب");
    // The chat fits above its composer, and the page does not scroll.
    const composer = (await page.getByTestId("composer").boundingBox())!;
    expect(composer.y + composer.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  });

  test("reading it marks it read: the badge loses the chat's unread message", async ({ page }) => {
    await openSignedIn(page, "/");
    await expect(messagesTab(page)).toHaveAccessibleName("پیام‌ها ۲ پیام نخونده، ۲ درخواست دوستی");
    const read = page.waitForResponse((response) => response.url().endsWith("/read") && response.request().method() === "PUT");
    await page.goto(sara);
    await expect(page.getByTestId("chat-name")).toHaveText("سارا");
    await read; // the chat told the server it was read
    if (wide(page)) await expect(messagesTab(page)).toHaveAccessibleName("پیام‌ها ۱ پیام نخونده، ۲ درخواست دوستی");
    await page.goto("/messages");
    await expect(page.locator("[data-unread='1']")).toHaveCount(1);
    await expect(page.getByTestId("inbox-row-sara.ghazal")).toHaveAttribute("data-unread", "0");
  });

  test("a text I send is in the list at once and stays; Enter sends, an empty field sends nothing, and Escape puts the keyboard away", async ({ page }) => {
    await openSignedIn(page, sara);
    const composer = page.getByTestId("composer");
    await composer.fill("   ");
    await composer.press("Enter");
    await expect(page.locator("[data-testid^=pending-]")).toHaveCount(0);
    await composer.fill("سلام سارا جان");
    await composer.press("Enter");
    await expect(composer).toHaveValue("");
    const sent = page.locator("[data-testid^=bubble-sent-]").filter({ hasText: "سلام سارا جان" });
    await expect(sent).toBeVisible();
    await expect(sent).toContainText("تو ·");
    await expect(page.locator("[data-testid^=pending-]")).toHaveCount(0);
    await composer.focus();
    await composer.press("Escape");
    await expect(composer).not.toBeFocused();
    // A tap on the messages does the same.
    await composer.focus();
    await page.getByTestId("chat-list").click({ position: { x: 20, y: 20 } });
    await expect(composer).not.toBeFocused();
    await page.reload(); // what was sent is on the server's side
    await expect(page.locator("[data-testid^=bubble-sent-]").filter({ hasText: "سلام سارا جان" })).toBeVisible();
  });

  test("a send that fails says «نرسید · دوباره», and tapping it sends the same message once", async ({ page }) => {
    await openSignedIn(page, sara);
    let failing = true;
    let tries = 0;
    await page.route("**/api/v1/conversations/*/messages", (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      tries += 1;
      return failing ? route.abort("failed") : route.fallback();
    });
    await page.getByTestId("composer").fill("دوباره بفرست");
    await page.getByTestId("composer").press("Enter");
    const retry = page.locator("[data-testid^=retry-]");
    await expect(retry).toHaveText("نرسید · دوباره");
    failing = false;
    await retry.click();
    await expect(page.locator("[data-testid^=bubble-sent-]").filter({ hasText: "دوباره بفرست" })).toBeVisible();
    await expect(retry).toHaveCount(0);
    expect(tries).toBe(2);
    // The server has it once: the same clientId made one message.
    const mine = await page.evaluate(async () => ((await (await fetch("/api/v1/conversations/c-sara_ghazal/messages")).json()) as { items: { text: string | null }[] }).items.filter((one) => one.text === "دوباره بفرست").length);
    expect(mine).toBe(1);
  });

  test("a couplet through the picker: search, choose, a note, send; the card appears and opens the poem at it", async ({ page }) => {
    await openSignedIn(page, sara);
    await page.getByTestId("quick-couplet").click();
    const picker = page.getByRole("dialog", { name: "بیت بفرست" });
    await expect(picker).toContainText("دیوانت هنوز خالیه؛ بالا دنبال یه بیت بگرد.");
    await picker.getByRole("searchbox", { name: "یه تیکه از بیت…" }).fill("اگر آن ترک");
    await picker.getByTestId("pick-/hafez/ghazal/sh3#0").click();
    await picker.getByTestId("picker-note").fill("یاد تو");
    await picker.getByTestId("picker-send").click();
    await expect(picker).toHaveCount(0);
    const mine = page.locator("[data-testid^=couplet-message-sent-]");
    await expect(mine).toContainText("تو یه بیت فرستادی");
    await expect(mine).toContainText("یاد تو");
    await expect(mine.locator("[data-testid^=couplet-card-]")).toContainText("حافظ");
    await mine.locator("[data-testid^=couplet-card-]").click();
    await expectReader(page, "غزل ۳");
    expect(new URL(page.url()).searchParams.get("c")).toBe("0");
  });

  test("the couplet card of Sara opens the reader at that couplet", async ({ page }) => {
    await openSignedIn(page, sara);
    await expect(page.getByTestId("couplet-card-m1")).toContainText("حافظ"); // read from its poem: until then the card is «…», not a link
    await page.getByTestId("couplet-card-m1").click();
    await expectReader(page, "غزل ۸");
    expect(new URL(page.url()).searchParams.get("c")).toBe("4");
  });

  test("my message is taken back after asking; one of Sara's is reported with a reason", async ({ page }) => {
    await openSignedIn(page, sara);
    await page.getByTestId("bubble-m3").click({ button: "right" });
    const question = asked(page, "این پیام پاک بشه؟");
    await expect(question).toBeVisible();
    await question.getByRole("button", { name: "نه" }).click();
    await expect(page.getByTestId("bubble-m3")).toContainText("وای چقدر قشنگه");
    await page.getByTestId("bubble-m3").click({ button: "right" });
    await question.getByRole("button", { name: "پاک کن" }).click();
    await expect(page.getByTestId("bubble-m3")).toContainText("این پیام پاک شد");
    await page.reload();
    await expect(page.getByTestId("bubble-m3")).toContainText("این پیام پاک شد");
    await page.getByTestId("couplet-message-m1").getByText("اینو دیدم یاد تو افتادم").click({ button: "right" });
    const reasons = asked(page, "چرا گزارشش می‌کنی؟");
    await expect(reasons).toContainText("بی‌احترامی");
    await reasons.getByTestId("reason-abuse").click();
    await expect(toasts(page)).toContainText("گزارشت رسید");
  });

  test("older messages are read when the list is scrolled to its top", async ({ page }) => {
    await openSignedIn(page, "/messages/kian_k");
    await expect(page.getByTestId("bubble-k3")).toBeVisible();
    await expect(page.getByTestId("divan-line-k2")).toContainText("کیان یه بیت به دیوان مشترک اضافه کرد");
    await expect(page.getByTestId("bubble-o1")).toBeVisible(); // the observer found the top of the short list at once
    await expect(page.getByTestId("bubble-o2")).toContainText("چطوری؟");
    expect(await page.getByTestId("chat-list").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  });

  test("the demo friend «یه بیت» has no game chips", async ({ page }) => {
    await openSignedIn(page, "/messages/yebeyt");
    await expect(page.getByTestId("chat-name")).toHaveText("یه بیت");
    await expect(page.getByTestId("quick-couplet")).toBeVisible();
    await expect(page.getByTestId("quick-daily")).toBeVisible();
    await expect(page.getByTestId("quick-mosh")).toHaveCount(0);
    await expect(page.getByTestId("quick-duel")).toHaveCount(0);
  });

  test("«پیام بده» on a friend's page opens the chat; a person who asked me has none", async ({ page }) => {
    await openSignedIn(page, "/u/sara.ghazal");
    await page.getByTestId("person-message").click();
    await expect(page).toHaveURL(/\/messages\/sara\.ghazal$/);
    await expect(page.getByTestId("chat-name")).toHaveText("سارا");
    await page.goto("/u/aryan");
    await expect(page.getByTestId("person-accept")).toBeVisible();
    await expect(page.getByTestId("person-message")).toHaveCount(0);
  });
});

test.describe("live", () => {
  test("a message of Sara's arrives in her open chat, which is read as it comes; away from it, it moves the badge, and in the inbox the row", async ({ page }) => {
    const live = await fakeLive(page);
    const setUnread = await serverUnread(page, { total: 2, friendRequests: 2 });
    await openSignedIn(page, sara);
    const message = (id: string, text: string) => ({ type: "message", message: { id, conversationId: "c-sara_ghazal", kind: "text", fromMe: false, text, key: null, note: null, payload: null, deleted: false, createdAt: new Date().toISOString() } });
    await expect(page.getByTestId("chat-name")).toHaveText("سارا");
    await live.push(message("live-1", "یه پیام زنده از سارا"));
    await expect(page.getByTestId("bubble-live-1")).toContainText("یه پیام زنده از سارا");
    expect(live.frames.find((frame) => frame.type === "auth")?.token).toMatch(/^debug-access\./);
    // The chat is open, so the message is read as it comes and the badge does not move (the server's total follows the read).
    await page.waitForTimeout(300);
    setUnread({ total: 1 });
    const reconnected = live.expectNewSocket();
    await page.goto("/");
    await reconnected();
    await expect(messagesTab(page)).toHaveAccessibleName("پیام‌ها ۱ پیام نخونده، ۲ درخواست دوستی");
    await live.push(message("live-2", "یه پیام دیگه")); // away from the chat: it counts
    await expect(messagesTab(page)).toHaveAccessibleName("پیام‌ها ۲ پیام نخونده، ۲ درخواست دوستی");
    setUnread({ total: 2 });
    const again = live.expectNewSocket();
    const lists: string[] = [];
    page.on("response", (response) => /\/api\/v1\/conversations\??$/.test(response.url()) && lists.push(response.url()));
    await page.goto("/messages");
    await again();
    await expect(page.locator("[data-testid^=inbox-row-]")).toHaveCount(5);
    // The inbox is read when it opens and again when the socket connects; an event is for the list as it is after that (the real server's list holds it).
    await expect.poll(() => lists.length).toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(250); // …and the page has put that list on screen
    await live.push(message("live-3", "این یکی توی صندوقه"));
    await expect(page.getByTestId("inbox-row-sara.ghazal")).toContainText("این یکی توی صندوقه");
    await expect(page.getByTestId("inbox-row-sara.ghazal")).toHaveAttribute("data-unread", "1");
    await expect(messagesTab(page)).toHaveAccessibleName("پیام‌ها ۳ پیام نخونده، ۲ درخواست دوستی");
    expect(await page.locator("[data-testid^=inbox-row-]").first().getAttribute("data-testid")).toBe("inbox-row-sara.ghazal");
  });

  test("a new message of hers is announced by a polite live region; older pages, the first load and my own sends are not", async ({ page }) => {
    const live = await fakeLive(page);
    await openSignedIn(page, "/messages/kian_k");
    const announcer = page.getByTestId("new-message-announcer");
    await expect(announcer).toHaveAttribute("aria-live", "polite");
    await expect(announcer).toHaveAttribute("role", "status");
    await expect(page.getByTestId("bubble-o2")).toBeVisible(); // the older page was added at the top
    await expect(announcer).toHaveText("");
    await page.getByTestId("composer").fill("از طرف من");
    await page.getByTestId("composer").press("Enter");
    await expect(page.locator("[data-testid^=bubble-sent-]")).toBeVisible();
    await expect(announcer).toHaveText("");
    await live.push({ type: "message", message: { id: "live-a", conversationId: "c-kian_k", kind: "text", fromMe: false, text: "سلام از کیان", key: null, note: null, payload: null, deleted: false, createdAt: new Date().toISOString() } });
    await expect(announcer).toHaveText("کیان: سلام از کیان");
  });

  test("a friend request comes live: the requests row and the badge count it, and the list has the row; an acceptance says so and takes the sent request away", async ({ page }) => {
    const live = await fakeLive(page);
    const setUnread = await serverUnread(page, { total: 2, friendRequests: 2 });
    await openSignedIn(page, "/messages");
    await expect(page.getByTestId("requests-count")).toHaveText("۲");
    await page.waitForTimeout(300); // the socket has connected, and the totals were read again
    setUnread({ friendRequests: 3 });
    // The server lists the new request too (the page reads the list when the screen opens).
    const person = (username: string, displayName: string) => ({ username, displayName, avatar: null, createdAt: new Date().toISOString() });
    await page.route(/\/api\/v1\/me\/friend-requests\?direction=incoming/, (route) => route.fulfill({ json: { items: [person("raha", "رها"), person("aryan", "آرین"), person("bardia", "بردیا")], nextCursor: null } }));
    await live.push({ type: "friend.request", from: { username: "raha", displayName: "رها", avatar: null } });
    await expect(page.getByTestId("requests-count")).toHaveText("۳");
    await expect(messagesTab(page)).toHaveAccessibleName(/۳ درخواست دوستی/);
    await page.getByTestId("requests-row").click();
    await expect(page.getByTestId("request-raha")).toContainText("رها");
    await expect(page.getByTestId("request-paria")).toBeVisible();
    await live.push({ type: "friend.accepted", from: { username: "paria", displayName: "پریا", avatar: null } });
    await expect(page.getByTestId("request-paria")).toHaveCount(0);
    await expect(toasts(page)).toContainText("پریا درخواستت رو قبول کرد");
  });

  test("the fake socket of a debug build (beytLive) brings Sara's message a moment after the page opens", async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("beytLive", "1"));
    await openSignedIn(page, "/messages");
    await expect(page.getByTestId("inbox-row-sara.ghazal")).toContainText("یه پیام زنده از سارا", { timeout: 6000 });
  });

  test("the socket opens with the token as its first message, and a guest has none", async ({ page }) => {
    const live = await fakeLive(page);
    await openSignedIn(page, "/messages");
    await expect.poll(() => live.frames.filter((frame) => frame.type === "auth").length).toBe(1);
    await page.evaluate(() => fetch("/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }));
    await page.reload();
    await page.waitForTimeout(500);
    expect(live.frames.filter((frame) => frame.type === "auth").length).toBe(1); // signed out: nothing opened
  });
});

test.describe("the shared divan", () => {
  test("shows the couplets with the counts, the privacy line and the chips; a chip filters; a like moves the words", async ({ page }) => {
    await openSignedIn(page, "/messages/sara.ghazal/divan");
    await expectRightToLeftAndFits(page);
    await expect(page.getByTestId("divan-title")).toHaveText("دیوان من و سارا");
    await expect(page.getByTestId("divan-subtitle")).toHaveText("۲۴ بیت · سارا ۱۳، تو ۱۱");
    await expect(page.getByText("فقط تو و سارا می‌بینید")).toBeVisible();
    for (const id of ["i1", "i2", "i3"]) await expect(page.getByTestId(`shared-item-${id}`)).toBeVisible();
    await expect(page.getByTestId("shared-item-i1")).toContainText("سارا اضافه کرد");
    await expect(page.getByTestId("shared-item-i1")).toContainText("یاد سفر شیراز افتادم");
    await expect(page.getByTestId("shared-item-i1")).toContainText("حافظ · غزل ۸");
    await expect(page.getByTestId("shared-item-i2")).toContainText("تو اضافه کرد");
    await expect(page.getByTestId("like-i1")).toContainText("تو پسندیدی");
    await expect(page.getByTestId("like-i2")).toContainText("سارا پسندید");
    await expect(page.getByTestId("like-i3")).toContainText("۰");
    for (const chip of ["chip-all", "chip-them", "chip-me", "chip-poet:hafez", "chip-poet:khayyam", "chip-poet:babataher"]) await expect(page.getByTestId(chip)).toBeVisible();
    await page.getByTestId("chip-me").click();
    await expect(page.getByTestId("shared-item-i2")).toBeVisible();
    await expect(page.getByTestId("shared-item-i1")).toHaveCount(0);
    await page.getByTestId("chip-poet:hafez").click();
    await expect(page.getByTestId("shared-item-i1")).toBeVisible();
    await expect(page.getByTestId("shared-item-i2")).toHaveCount(0);
    await page.getByTestId("chip-all").click();
    await page.getByTestId("like-i3").click();
    await expect(page.getByTestId("like-i3")).toContainText("تو پسندیدی");
    await page.getByTestId("like-i1").click();
    await expect(page.getByTestId("like-i1")).toContainText("۰");
    await page.getByTestId("shared-couplet-i1").click();
    await expectReader(page, "غزل ۸");
  });

  test("a couplet I added is taken out after asking («نه» keeps it), for both; one of hers cannot be; the live removal of hers leaves too", async ({ page }) => {
    const live = await fakeLive(page);
    await openSignedIn(page, "/messages/sara.ghazal/divan");
    await expect(page.getByTestId("shared-item-i2")).toBeVisible();
    await page.getByTestId("shared-couplet-i1").click({ button: "right" }); // hers: nothing to ask
    await expect(asked(page, "از دیوان مشترک برداشته بشه؟")).toHaveCount(0);
    await page.getByTestId("shared-couplet-i2").click({ button: "right" });
    const question = asked(page, "از دیوان مشترک برداشته بشه؟");
    await expect(question).toContainText("برای سارا هم برداشته می‌شه.");
    await question.getByRole("button", { name: "نه" }).click();
    await expect(page.getByTestId("shared-item-i2")).toBeVisible();
    await page.getByTestId("shared-couplet-i2").click({ button: "right" });
    await question.getByRole("button", { name: "بردار" }).click();
    await expect(page.getByTestId("shared-item-i2")).toHaveCount(0);
    await expect(page.getByTestId("divan-subtitle")).toHaveText("۲۳ بیت · سارا ۱۳، تو ۱۰");
    await live.push({ type: "divan.removed", sharedDivanId: "d-sara_ghazal", itemId: "i3" });
    await expect(page.getByTestId("shared-item-i3")).toHaveCount(0);
    await expect(page.getByTestId("divan-subtitle")).toHaveText("۲۲ بیت · سارا ۱۲، تو ۱۰");
    await page.reload();
    await expect(page.getByTestId("shared-item-i1")).toBeVisible();
    await expect(page.getByTestId("shared-item-i2")).toHaveCount(0);
  });

  test("a ⋯ button on a couplet I added opens the same question for a mouse or a key, and none is on one of hers", async ({ page, browserName }) => {
    await openSignedIn(page, "/messages/sara.ghazal/divan");
    await expect(page.getByTestId("shared-item-i2")).toBeVisible();
    await expect(page.getByTestId("divan-more-i1")).toHaveCount(0); // hers
    const more = page.getByTestId("divan-more-i2");
    const fine = await page.evaluate(() => matchMedia("(pointer: fine)").matches);
    if (fine) await expect(more).toHaveCSS("opacity", "1"); // drawn for a mouse; a finger long-presses the couplet
    else await expect(more).toHaveCSS("opacity", "0");
    await more.focus();
    if (browserName === "chromium") {
      // …and a key reaches it either way, and shows it (Safari does not Tab onto buttons unless its setting says so).
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(more).toBeFocused();
      await expect(more).toHaveCSS("opacity", "1");
    }
    await page.keyboard.press("Enter");
    const question = asked(page, "از دیوان مشترک برداشته بشه؟");
    await expect(question).toContainText("برای سارا هم برداشته می‌شه.");
    await question.getByRole("button", { name: "نه" }).click();
    await expect(page.getByTestId("shared-item-i2")).toBeVisible();
    await more.focus();
    await page.keyboard.press("Enter");
    await question.getByRole("button", { name: "بردار" }).click();
    await expect(page.getByTestId("shared-item-i2")).toHaveCount(0);
    await expect(page.getByTestId("divan-subtitle")).toHaveText("۲۳ بیت · سارا ۱۳، تو ۱۰");
  });

  test("«+» adds a couplet through the picker, and a live one of hers comes in at the top", async ({ page }) => {
    const live = await fakeLive(page);
    await openSignedIn(page, "/messages/sara.ghazal/divan");
    await expect(page.getByTestId("shared-item-i1")).toBeVisible(); // the divan is read: adding to it needs it
    await page.getByTestId("add-to-divan").click();
    const picker = page.getByRole("dialog", { name: "یه بیت اضافه کن" });
    await picker.getByRole("searchbox").fill("اگر آن ترک");
    await picker.getByTestId("pick-/hafez/ghazal/sh3#0").click();
    await picker.getByTestId("picker-note").fill("برای تو");
    await picker.getByTestId("picker-send").click();
    await expect(page.locator("[data-testid^=shared-item-item-]").first()).toContainText("برای تو");
    await expect(page.getByTestId("divan-subtitle")).toHaveText("۲۵ بیت · سارا ۱۳، تو ۱۲");
    await live.push({ type: "divan", sharedDivanId: "d-sara_ghazal", item: { id: "live-i", key: "/hafez/ghazal/sh1#0", note: null, addedByMe: false, createdAt: new Date().toISOString(), likedByMe: false, likedByThem: false } });
    await expect(page.getByTestId("shared-item-live-i")).toBeVisible();
    await expect(page.getByTestId("divan-subtitle")).toHaveText("۲۶ بیت · سارا ۱۴، تو ۱۲");
  });

  test("the chat's «دیوان مشترک» opens it, and the divan line of Kian's chat does too", async ({ page }) => {
    await openSignedIn(page, sara);
    await page.getByTestId("shared-divan-link").click();
    await expect(page).toHaveURL(/\/messages\/sara\.ghazal\/divan$/);
    await expect(page.getByTestId("divan-title")).toHaveText("دیوان من و سارا");
    await page.goto("/messages/kian_k");
    await page.getByTestId("divan-line-k2").click();
    await expect(page.getByTestId("divan-title")).toHaveText("دیوان من و کیان");
  });

  test("the reader's hold menu «به دیوان مشترک» adds the couplet to a friend's divan, with the friends who have none under «با یه دوست دیگه»", async ({ page }) => {
    await openSignedIn(page, "/poem/hafez/ghazal/sh3?c=1");
    await expect(page.getByTestId("reader-title")).toHaveText("غزل ۳");
    await page.getByTestId("couplet-1").click({ button: "right" });
    await page.getByRole("dialog", { name: "کارهای این بیت" }).getByRole("button", { name: "به دیوان مشترک" }).click();
    const sheet = page.getByRole("dialog", { name: "به دیوان مشترک" });
    await expect(sheet.getByTestId("divan-with-sara.ghazal")).toContainText("۲۴ بیت");
    await expect(sheet.getByTestId("divan-with-kian_k")).toBeVisible();
    await sheet.getByTestId("other-friend").click();
    await expect(sheet.getByText("دوستای دیگه")).toBeVisible();
    await expect(sheet.getByTestId("divan-with-yebeyt")).toBeVisible();
    await sheet.getByTestId("divan-with-mahsa.m").click();
    await expect(sheet).toContainText("دیوان من و مهسا");
    await sheet.getByTestId("divan-note").fill("یاد تو");
    await sheet.getByTestId("divan-add").click();
    await expect(toasts(page)).toContainText("به دیوان من و مهسا اضافه شد");
    await expect(sheet).toHaveCount(0);
    await page.goto("/messages/mahsa.m/divan");
    await expect(page.getByTestId("divan-subtitle")).toHaveText("۱ بیت · مهسا ۰، تو ۱");
    await expect(page.locator("[data-testid^=shared-item-]").first()).toContainText("یاد تو");
  });

  test("a debug build can open the sheet at once (beytDivanSheet), as the phone's launch argument does", async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("beytDivanSheet", "1"));
    await openSignedIn(page, "/messages");
    const sheet = page.getByRole("dialog", { name: "به دیوان مشترک" });
    await expect(sheet.getByTestId("divan-with-sara.ghazal")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  });

  test("a guest who asks the hold menu for «به دیوان مشترک» gets the gate, and the sheet follows the sign-in", async ({ page }) => {
    await openAccountApp(page, "/poem/hafez/ghazal/sh3?c=1");
    await page.getByTestId("couplet-1").click({ button: "right" });
    await page.getByRole("dialog", { name: "کارهای این بیت" }).getByRole("button", { name: "به دیوان مشترک" }).click();
    await expect(gate(page)).toBeVisible();
  });
});

test.describe("what is private to the feedback screenshot", () => {
  test("on every messages screen, any message, preview or note text and every field sits inside a private view", async ({ page }) => {
    const live = await fakeLive(page);
    await openSignedIn(page, "/messages");
    await expect(page.locator("[data-testid^=inbox-row-]")).toHaveCount(5);
    await expectAllPrivate(page, { texts: 4, fields: 1 }); // the previews, the search
    await page.getByTestId("inbox-compose").click();
    await expect(page.getByRole("dialog", { name: "پیام تازه" })).toBeVisible();
    await expectAllPrivate(page, { texts: 4, fields: 2 }); // the people search too
    await page.keyboard.press("Escape");

    await page.goto(sara);
    await expect(page.getByTestId("bubble-m3")).toBeVisible();
    await page.getByTestId("composer").fill("پیام آزمایشی خصوصی");
    await page.getByTestId("composer").press("Enter");
    await expect(page.locator("[data-testid^=bubble-sent-]")).toBeVisible();
    await live.push({ type: "message", message: { id: "live-p", conversationId: "c-sara_ghazal", kind: "text", fromMe: false, text: "یه پیام زنده خصوصی", key: null, note: null, payload: null, deleted: false, createdAt: new Date().toISOString() } });
    await expect(page.getByTestId("bubble-live-p")).toBeVisible();
    await expect(page.getByTestId("new-message-announcer")).toContainText("یه پیام زنده خصوصی"); // the live region says the text: it is private too
    await expectAllPrivate(page, { texts: 5, fields: 1 }); // the bubbles, the note under the couplet, the announcer, the composer
    await page.getByTestId("quick-couplet").click();
    const picker = page.getByRole("dialog", { name: "بیت بفرست" });
    await expectAllPrivate(page, { texts: 5, fields: 2 });
    await picker.getByRole("searchbox").fill("اگر آن ترک");
    await picker.getByTestId("pick-/hafez/ghazal/sh3#0").click();
    await picker.getByTestId("picker-note").fill("یادداشت خصوصی");
    await expectAllPrivate(page, { texts: 5, fields: 2 });
    await page.keyboard.press("Escape");

    await page.goto("/messages/kian_k");
    await expect(page.getByTestId("bubble-o2")).toBeVisible(); // the older page too
    await expectAllPrivate(page, { texts: 3, fields: 1 });

    await page.goto("/messages/sara.ghazal/divan");
    await expect(page.getByTestId("shared-item-i1")).toBeVisible();
    await expectAllPrivate(page, { texts: 1 }); // her note on a couplet
    await page.getByTestId("add-to-divan").click();
    await expectAllPrivate(page, { texts: 1, fields: 1 });
  });

  test("the note field of the sheet «به دیوان مشترک» is private", async ({ page }) => {
    await openSignedIn(page, "/poem/hafez/ghazal/sh3?c=1");
    await page.getByTestId("couplet-1").click({ button: "right" });
    await page.getByRole("dialog", { name: "کارهای این بیت" }).getByRole("button", { name: "به دیوان مشترک" }).click();
    await page.getByTestId("divan-with-sara.ghazal").click();
    await page.getByTestId("divan-note").fill("یادداشت خصوصی");
    await expectAllPrivate(page, { texts: 0, fields: 1 }); // what is typed is the field's value, not a text node
  });
});
