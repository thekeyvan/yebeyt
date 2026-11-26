import { expect, test, type Page } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

type Moves = { longest: { what: string; ms: number }; animations: { what: string; ms: number }[] };

/**
 * Watches the transform, translate, scale and rotate of every element on each frame, and every running animation of them.
 * One move is a stretch of frames that keep going the same way: a pause of 100 ms, or a turn back (a squish letting go),
 * starts the next one.
 */
async function watchMoves(page: Page) {
  await page.evaluate(() => {
    type Track = { start: number; last: number; vector: number[]; signs: number[] };
    const seen = new Map<Element, Track>();
    const animations: { what: string; ms: number }[] = [];
    let longest = { what: "", ms: 0 };
    const w = window as unknown as { __moves: () => Moves; __stop: boolean };
    w.__stop = false;
    const label = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}.${String(el.getAttribute("class") ?? "").slice(0, 40)}`;
    const part = (text: string, index: number, fallback: number) => Number(text.match(/-?\d*\.?\d+/g)?.[index] ?? fallback);
    const vectorOf = (style: CSSStyleDeclaration) => {
      const matrix = new DOMMatrix(style.transform === "none" ? undefined : style.transform);
      return [matrix.a, matrix.d, matrix.e, matrix.f, part(style.translate, 0, 0), part(style.translate, 1, 0), part(style.scale, 0, 1), part(style.rotate, 0, 0)];
    };
    const frame = (now: number) => {
      for (const el of document.querySelectorAll("*")) {
        const vector = vectorOf(getComputedStyle(el));
        const track = seen.get(el);
        if (!track) {
          seen.set(el, { start: -1, last: -1, vector, signs: vector.map(() => 0) });
          continue;
        }
        const deltas = vector.map((value, i) => value - track.vector[i]!);
        if (deltas.every((delta) => Math.abs(delta) < 1e-6)) continue;
        const turned = deltas.some((delta, i) => Math.abs(delta) >= 1e-6 && track.signs[i] !== 0 && Math.sign(delta) !== track.signs[i]);
        if (track.start < 0 || turned || now - track.last > 100) track.start = now;
        track.last = now;
        track.signs = deltas.map((delta, i) => (Math.abs(delta) < 1e-6 ? track.signs[i]! : Math.sign(delta)));
        track.vector = vector;
        if (now - track.start > longest.ms) longest = { what: label(el), ms: now - track.start };
      }
      for (const animation of document.getAnimations()) {
        const effect = animation.effect as KeyframeEffect | null;
        const moves = effect?.getKeyframes().some((keyframe) => ["transform", "translate", "scale", "rotate"].some((name) => name in keyframe));
        const timing = effect?.getComputedTiming();
        if (moves && timing && effect?.target) animations.push({ what: label(effect.target), ms: Number(timing.duration) + Number(timing.delay) });
      }
      if (!w.__stop) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    w.__moves = () => {
      w.__stop = true;
      return { longest, animations };
    };
  });
}

test("with reduced motion nothing moves for longer than 0.15 s", async ({ page }) => {
  await page.goto("/dev/stickers");
  await watchMoves(page);

  // A pressed button, a tab inside the page, a sheet opening and closing, a confirm, a toast, and a tab of the bar.
  const squish = page.getByRole("button", { name: "بزن بریم" });
  const box = (await squish.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(300);

  await page.getByRole("tab", { name: "دوم" }).click();
  await page.waitForTimeout(400);

  await page.getByRole("button", { name: "باز کردن برگه" }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });

  await page.getByRole("button", { name: "با برگردون" }).click();
  await page.getByRole("region", { name: "اعلان‌ها" }).waitFor();
  await page.waitForTimeout(500);

  await page.getByRole("navigation", { name: "تب‌ها" }).getByRole("link", { name: "کاوش" }).click();
  await page.waitForURL("**/explore");
  await page.waitForTimeout(700);

  const { longest, animations } = await page.evaluate(() => (window as unknown as { __moves: () => Moves }).__moves());
  expect(longest.ms, `${longest.what} moved for ${longest.ms} ms`).toBeLessThanOrEqual(170);
  for (const { what, ms } of animations) expect(ms, `${what} animates for ${ms} ms`).toBeLessThanOrEqual(150);
});
