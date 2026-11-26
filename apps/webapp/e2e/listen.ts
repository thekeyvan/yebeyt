import { expect, type Page } from "@playwright/test";
import { today } from "./browse";
import { deck, openGame } from "./quiz";
import { ranged, silence, stubNetwork } from "./reader";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const hafez = JSON.parse(readFileSync(join(process.cwd(), "../ios/Yebeyt/Resources/Data/book-24.json"), "utf8")) as { poems: { id: number; path: string }[] };

/** The recitation the deck measured each Hafez poem's clips against (poem id → recitation id). */
const measuredFor = new Map(hafez.poems.flatMap((poem) => deck.filter((entry) => entry.poem === poem.path && entry.clip).slice(0, 1).map((entry) => [poem.id, entry.clip!.recitation] as const)));

const cors = { "access-control-allow-origin": "*" };

/** The timing file of a poem: every verse starts six seconds after the one before, so couplet n's first hemistich is read from 12n to 12n + 6. */
const timing = `<A><PoemAudio><SyncArray>${Array.from({ length: 20 }, (_, verse) => `<SyncInfo><VerseOrder>${verse}</VerseOrder><AudioMiliseconds>${verse * 6000}</AudioMiliseconds></SyncInfo>`).join("")}</SyncArray></PoemAudio></A>`;

/** What the stubbed Ganjoor says: `measured` gives each poem the recitation its deck clips were measured against (so they play as measured), `margin` another (so the margin rule decides), `none` no recitation, `broken` audio that will not load. */
export type Recitations = "measured" | "margin" | "none" | "broken";

/** The Ganjoor API, its audio (silence, 130 s: longer than any clip's end) and timing, over the stubs of every other test (`stubNetwork`), which this takes the place of. */
export async function stubListen(page: Page, recitations: Recitations) {
  const audio = silence(130);
  await page.route("https://api.ganjoor.net/**/recitations", (route) => {
    const poemId = Number(/poem\/(\d+)\/recitations/.exec(route.request().url())![1]);
    const list =
      recitations === "none"
        ? []
        : [{ id: recitations === "measured" ? (measuredFor.get(poemId) ?? 1) : 1, poemId, audioArtist: "فریدون فرح‌اندوز", mp3Url: `https://i.ganjoor.net/a/${poemId}.wav`, xmlUrl: `https://i.ganjoor.net/a/x/${poemId}.xml`, audioOrder: 1, inSyncWithText: true }];
    return route.fulfill({ contentType: "application/json", headers: cors, body: JSON.stringify(list) });
  });
  await page.route("https://i.ganjoor.net/a/x/*.xml", (route) => route.fulfill({ contentType: "text/xml", headers: cors, body: timing }));
  await page.route("https://i.ganjoor.net/a/*.wav", (route) => (recitations === "broken" ? route.abort() : ranged(route, audio)));
}

/** Opens گوش کن on the fixed day and round with these recitations. */
export async function openListen(page: Page, recitations: Recitations) {
  await stubNetwork(page);
  await stubListen(page, recitations);
  await page.addInitScript((day) => sessionStorage.setItem("beytToday", day), today);
  await openGame(page, "/games/listen", false);
}

export type Clip = { start: number; end: number; fade: number };

/** The clip of the question in play, as the card has it. */
export async function clipOnCard(page: Page): Promise<Clip> {
  const card = page.getByTestId("listen-card");
  await expect(card).toBeVisible();
  const read = async (name: string) => Number(await card.getAttribute(`data-clip-${name}`));
  return { start: await read("start"), end: await read("end"), fade: await read("fade") };
}

/** Where the page's audio is, and whether it plays (the page's `<audio>` is the one `play()` was last called on: see `stubNetwork`). */
export const audioNow = (page: Page) => page.evaluate(() => {
  const audio = (window as unknown as { __audio?: HTMLAudioElement }).__audio;
  return audio && { time: audio.currentTime, paused: audio.paused };
});

/** Waits until the clip has played and stopped by itself, and gives where the audio stopped. */
export async function playedToTheEnd(page: Page) {
  await expect(page.getByTestId("listen-card")).toHaveAttribute("data-state", "ended", { timeout: 20_000 });
  return (await audioNow(page))!;
}
