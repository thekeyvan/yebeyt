import { expect, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Hafez's ghazal 3 (nine couplets, all with a meaning) is in the bundled files, so it opens with no network. */
export const poem = "/poem/hafez/ghazal/sh3";

const fixture = (name: string) => readFileSync(join(process.cwd(), "test/fixtures", name), "utf8");

/** A silent 8 kHz, 8-bit WAV of `seconds` (a few hundred KB): the browsers play it, and nothing real is fetched. */
export function silence(seconds: number): Buffer {
  const rate = 8000;
  const data = Buffer.alloc(rate * seconds, 0x80);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** The timing file of the nine couplets of the poem: every verse starts a second after the one before, so couplet n starts at 2n seconds. */
export const timingXML = `<A><PoemAudio><SyncArray>${Array.from({ length: 18 }, (_, verse) => `<SyncInfo><VerseOrder>${verse}</VerseOrder><AudioMiliseconds>${verse * 1000}</AudioMiliseconds></SyncInfo>`).join("")}</SyncArray></PoemAudio></A>`;

/** Answers a request for audio from `body`, with the byte ranges browsers ask for. */
export function ranged(route: Route, body: Buffer) {
  const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range ?? "");
  const headers = { "content-type": "audio/wav", "accept-ranges": "bytes", "access-control-allow-origin": "*" };
  if (!range) return route.fulfill({ status: 200, headers, body });
  const start = Number(range[1]);
  const end = range[2] ? Number(range[2]) : body.length - 1;
  return route.fulfill({ status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${body.length}` }, body: body.subarray(start, end + 1) });
}

/**
 * No network in e2e: the Ganjoor API answers with the recitations fixture of this poem (its first recitation has timing), the audio is a silent
 * WAV served with ranges, and the timing is `timingXML`. Anything else that is not the app itself is refused.
 */
export async function stubNetwork(page: Page, { api = false }: { api?: boolean } = {}): Promise<void> {
  const recitations = fixture("recitations.json");
  const audio = silence(40);
  await page.route((url) => url.hostname !== "localhost", (route) => {
    const url = route.request().url();
    if (url.endsWith("/recitations")) return route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: recitations });
    if (url.endsWith(".xml")) return route.fulfill({ contentType: "text/xml", headers: { "access-control-allow-origin": "*" }, body: timingXML });
    if (/\.(mp3|wav)$/.test(url)) return ranged(route, audio);
    return route.abort();
  });
  // The web app's own door to the server (/api) has nothing behind it here, except for a test of the account (`api`), whose debug sign-in the door answers itself.
  if (!api) await page.route((url) => url.hostname === "localhost" && url.pathname.startsWith("/api/"), (route) => route.fulfill({ status: 502 }));
  // What the page plays, for the tests that look at the audio.
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      (window as unknown as { __audio: HTMLMediaElement }).__audio = this;
      return play.call(this);
    };
    // No share sheet unless a test brings one (Safari has one, which a test cannot see).
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    // What was copied, since reading the clipboard needs a permission some browsers do not give.
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text: string) => ((window as unknown as { __copied: string }).__copied = text) }, configurable: true });
  });
}

/** The audio's position in seconds, or -1 before anything has played. */
export const audioTime = (page: Page) => page.evaluate(() => (window as unknown as { __audio?: HTMLMediaElement }).__audio?.currentTime ?? -1);

export const copied = (page: Page) => page.evaluate(() => (window as unknown as { __copied?: string }).__copied);

/** Opens the reader on `query` and waits for the poem to be on screen. */
export async function openPoem(page: Page, query = "") {
  await page.goto(`${poem}${query}`);
  await expect(page.getByTestId("reader-title")).toHaveText("غزل ۳");
  await afterPaint(page);
}

/** The page is drawn a frame or two before its key handlers are all in place: waits for that, so a key pressed at once is not lost. */
export const afterPaint = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

/** The number in the address: the couplet the reader is on. */
export const coupletInURL = (page: Page) => Number(new URL(page.url()).searchParams.get("c"));

/** A finger (Chromium: real touch events through the protocol) or, where the browser cannot, the mouse, from `from` to `to`. */
export async function drag(page: Page, browserName: string, from: { x: number; y: number }, to: { x: number; y: number }) {
  const steps = 12;
  const at = (i: number) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
  if (browserName === "chromium" && (await page.evaluate(() => matchMedia("(pointer: coarse)").matches))) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
    for (let i = 1; i <= steps; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(i)] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    return;
  }
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(at(i).x, at(i).y);
  await page.mouse.up();
}
