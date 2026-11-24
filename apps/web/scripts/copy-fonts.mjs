// Copies the fonts the website uses (the `fonts` of packages/tokens/tokens.json) from assets/fonts into public/fonts.
// They are served from our own domain; no Google Fonts. public/fonts is not committed.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../../../", import.meta.url);
const target = new URL("../public/fonts/", import.meta.url);
const tokens = JSON.parse(readFileSync(new URL("packages/tokens/tokens.json", root), "utf8"));

mkdirSync(target, { recursive: true });
for (const { file } of Object.values(tokens.fonts)) {
  copyFileSync(new URL(`assets/fonts/${file}`, root), new URL(file, target));
}
console.log(`copied ${Object.keys(tokens.fonts).length} fonts to ${fileURLToPath(target)}`);
