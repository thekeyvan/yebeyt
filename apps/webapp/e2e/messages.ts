import { expect, type Page } from "@playwright/test";
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

/** Whether every element of `selector` is, or is inside, a view marked private to the feedback screenshot; the number of elements checked. */
export async function privateness(page: Page, selector: string): Promise<{ checked: number; unmarked: number }> {
  return page.evaluate((sel) => {
    const nodes = [...document.querySelectorAll(sel)];
    return { checked: nodes.length, unmarked: nodes.filter((node) => !node.closest("[data-feedback-private]")).length };
  }, selector);
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
