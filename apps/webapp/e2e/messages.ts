import { expect, type Locator, type Page } from "@playwright/test";
import { tabBar } from "./browse";

/**
 * The live socket of the page, served by the test: Playwright answers the page's `WebSocket` itself (`page.routeWebSocket`), so no server is needed and the page's own code
 * runs as it does for real (the address from `/auth/live`, the auth frame, `ready`). Set it up before the page opens; `push` sends an event as the server would.
 */
export async function fakeLive(page: Page) {
  type Open = { send(frame: string): void; authenticated: boolean; closed: boolean };
  const sockets: Open[] = [];
  const frames: { type?: string; token?: string }[] = [];
  await page.routeWebSocket(/\/v1\/live$/, (socket) => {
    const open: Open = { send: (frame) => socket.send(frame), authenticated: false, closed: false };
    sockets.push(open);
    socket.onClose(() => (open.closed = true));
    socket.onMessage((frame) => {
      const message = JSON.parse(String(frame)) as { type?: string; token?: string };
      frames.push(message);
      if (message.type === "auth") {
        open.authenticated = true;
        socket.send('{"type":"ready"}');
      }
    });
  });
  return {
    /** The frames the page sent. */
    frames,
    /** Waits for a socket that is ready (the page may have opened a new one since the last), then sends an event of the contract on it. */
    async push(event: object) {
      await expect.poll(() => sockets.some((socket) => socket.authenticated && !socket.closed)).toBe(true);
      sockets.findLast((socket) => socket.authenticated && !socket.closed)!.send(JSON.stringify(event));
    },
    /** Call before a navigation that makes the page open a new socket; await the function it returns after it (the old page's socket may not be seen as closed yet). */
    expectNewSocket() {
      const before = sockets.length;
      return () => expect.poll(() => sockets.slice(before).some((socket) => socket.authenticated && !socket.closed)).toBe(true);
    },
    sockets: () => sockets.length,
  };
}

/** The tab bar's link to پیام‌ها with the badge's words, e.g. «پیام‌ها ۲ پیام نخونده، ۲ درخواست دوستی». */
export const messagesTab = (page: Page) => tabBar(page).getByRole("link", { name: /^پیام‌ها/ });

/** The page ends clear of the tab bar (phones) or the rail (wide screens): the last of `selector` is not under it. */
export async function endsClearOfTabs(page: Page, selector: string): Promise<boolean> {
  await page.evaluate((sel) => {
    const nodes = document.querySelectorAll(sel);
    nodes[nodes.length - 1]?.scrollIntoView({ block: "end" });
    window.scrollTo(0, document.documentElement.scrollHeight);
  }, selector);
  await page.waitForTimeout(150);
  return page.evaluate((sel) => {
    const nav = document.querySelector("nav[aria-label='تب‌ها']")!.getBoundingClientRect();
    const nodes = document.querySelectorAll(sel);
    const box = nodes[nodes.length - 1]!.getBoundingClientRect();
    if (nav.width === 0) return true; // hidden on a phone
    return nav.height > nav.width ? box.right <= nav.left || box.left >= nav.right : box.bottom <= nav.top;
  }, selector);
}

/** The message text, previews and notes of the debug server's chats and shared divans (`lib/api/stubMessages.ts`), and what the tests write. */
export const chatTexts = [
  "وای چقدر قشنگه! ممنون",
  "اینو دیدم یاد تو افتادم",
  "بیت قشنگی بود",
  "فردا معما رو با هم حل کنیم؟",
  "این رباعی رو ببین",
  "مهسا تو رو به جورچین بیت چالش کشید",
  "سلام کیان",
  "چطوری؟",
  "یاد سفر شیراز افتادم",
  "دعوتت کرد به بازی",
  "یه بیت فرستاد",
  "پیام آزمایشی خصوصی",
  "یه پیام زنده خصوصی",
  "یادداشت خصوصی",
];

/**
 * Walks every text node and every field of the page: each text of `chatTexts` must sit inside a view marked private to the feedback screenshot, and so must every field that takes typed
 * text (an input that is not a slider, a box or a button, and a textarea). `texts` is how many of the known texts are on the screen (a screen that shows none would prove nothing), `fields` how many fields.
 */
export async function expectAllPrivate(page: Page, expected: { texts: number; fields?: number }): Promise<void> {
  const found = await page.evaluate((known) => {
    const unmarked: string[] = [];
    let texts = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      if (!known.some((one) => text.includes(one))) continue;
      texts += 1;
      if (!node.parentElement?.closest("[data-feedback-private]")) unmarked.push(text.trim());
    }
    const fields = [...document.querySelectorAll("input:not([type=hidden], [type=range], [type=checkbox], [type=radio], [type=button], [type=submit]), textarea")];
    const loose = fields.filter((field) => !field.closest("[data-feedback-private]")).map((field) => field.getAttribute("data-testid") ?? field.getAttribute("aria-label") ?? field.tagName);
    return { texts, unmarked, fields: fields.length, loose };
  }, chatTexts);
  expect(found.unmarked, "message text outside a private view").toEqual([]);
  expect(found.loose, "fields outside a private view").toEqual([]);
  expect(found.texts, "known texts on the screen").toBeGreaterThanOrEqual(expected.texts);
  expect(found.fields, "fields on the screen").toBeGreaterThanOrEqual(expected.fields ?? 0);
}

/**
 * What the server says is unread (`/v1/me/unread`), which the page asks for when it opens and every time the socket connects: a test that pushes an event the debug server
 * does not know of makes it say so too, as the real server would, so the answer does not undo the event.
 */
export async function serverUnread(page: Page, initial: { total: number; friendRequests: number }) {
  const now = { ...initial };
  await page.route("**/api/v1/me/unread", (route) => route.fulfill({ json: now }));
  return (next: Partial<typeof now>) => void Object.assign(now, next);
}

/**
 * Types into a field of a page that has only just come up. In WebKit, under load, text put in the first moment after a page loads is sometimes wiped again (the field is
 * empty again afterwards; the cause was not found, and the same page typed into later keeps it); so what was typed is looked at, and typed again until it stays.
 */
export const typeIn = (field: Locator, text: string) =>
  expect(async () => {
    await field.fill(text);
    await expect(field).toHaveValue(text, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
