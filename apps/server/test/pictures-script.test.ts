import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { knownPoetSlugs, planUploads, renderPicture } from "../scripts/pictures.js";

const known = new Set(["hafez", "moulavi", "ferdousi", "roodaki", "saadi"]);

describe("planUploads", () => {
  it("maps file names to Ganjoor slugs and reports the rest", () => {
    const plan = planUploads(
      ["poet-hafez.png", "poet-rumi.png", "poet-ferdowsi.png", "poet-rudaki.png", "poet-saadi.png", "poet-nima.png", "notes.txt", "poet-hafez.jpg", "README.md"],
      known,
    );
    expect(plan.uploads).toEqual([
      { file: "poet-ferdowsi.png", slug: "ferdousi" },
      { file: "poet-hafez.png", slug: "hafez" },
      { file: "poet-rudaki.png", slug: "roodaki" },
      { file: "poet-rumi.png", slug: "moulavi" },
      { file: "poet-saadi.png", slug: "saadi" },
    ]);
    expect(plan.skipped).toEqual([{ file: "poet-nima.png", reason: "no poet with slug nima in poets.json" }]);
  });

  it("only looks at poet-*.png files", () => {
    expect(planUploads(["a.png", "poet-.png", "poet-x.jpg"], known)).toEqual({ uploads: [], skipped: [] });
  });

  it("knows the real slugs of the committed poets.json, and the 11 of the 16 portraits that have one", () => {
    const slugs = knownPoetSlugs();
    for (const s of ["hafez", "moulavi", "ferdousi", "roodaki", "babataher", "shahriar", "parvin", "attar", "khayyam", "nezami", "saadi"]) {
      expect(slugs.has(s)).toBe(true);
    }
  });
});

describe("renderPicture", () => {
  it("makes a 512×512 WebP and keeps transparency", async () => {
    const source = await sharp({ create: { width: 1024, height: 800, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
      .png()
      .toBuffer();
    const out = await renderPicture(source);
    expect(out).toMatchObject({ contentType: "image/webp", width: 512, height: 512 });
    const meta = await sharp(out.bytes).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 512, height: 512, hasAlpha: true });
    expect(out.bytes.length).toBeLessThan(2 * 1024 * 1024);
  });
});
