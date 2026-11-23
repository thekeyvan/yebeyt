import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/** File names in design/poets that differ from the Ganjoor slug. */
const ALIASES: Record<string, string> = { rumi: "moulavi", ferdowsi: "ferdousi", rudaki: "roodaki" };

const POETS_JSON = fileURLToPath(new URL("../../ios/Yebeyt/Resources/Data/poets.json", import.meta.url));

/** The Ganjoor slugs the app knows, from the committed poets.json. */
export function knownPoetSlugs(): Set<string> {
  const { poets } = JSON.parse(readFileSync(POETS_JSON, "utf8")) as { poets: { slug: string }[] };
  return new Set(poets.map((p) => p.slug));
}

export type Plan = {
  uploads: { file: string; slug: string }[];
  skipped: { file: string; reason: string }[];
};

/** Picks the `poet-<name>.png` files and maps them to slugs; files whose poet is unknown are skipped. */
export function planUploads(fileNames: string[], known: Set<string>): Plan {
  const plan: Plan = { uploads: [], skipped: [] };
  for (const file of fileNames.filter((f) => /^poet-.+\.png$/.test(f)).sort()) {
    const name = file.slice("poet-".length, -".png".length);
    const slug = ALIASES[name] ?? name;
    if (known.has(slug)) plan.uploads.push({ file, slug });
    else plan.skipped.push({ file, reason: `no poet with slug ${slug} in poets.json` });
  }
  return plan;
}

/** 512×512 WebP, quality 82. WebP keeps the transparent background the portraits are drawn on. */
export async function renderPicture(source: Buffer) {
  const { data, info } = await sharp(source)
    .resize(512, 512, { fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { bytes: data, contentType: "image/webp", width: info.width, height: info.height };
}
