// Copies the fonts an app uses from assets/fonts into a folder of the app (public/fonts, not committed), so they are
// served from our own domain; no Google Fonts.
// Usage (from the app's folder): node ../../packages/tokens/copy-fonts.mjs <target folder> [--reader]
// The `fonts` of tokens.json are always copied; --reader adds the `readerFonts` of the reader's text sheet.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = new URL("../../", import.meta.url);
const target = resolve(process.argv[2] ?? "public/fonts");
const tokens = JSON.parse(readFileSync(new URL("packages/tokens/tokens.json", root), "utf8"));
const groups = process.argv.includes("--reader") ? [tokens.fonts, tokens.readerFonts] : [tokens.fonts];
const files = new Set(groups.flatMap((group) => Object.values(group).map(({ file }) => file)));

mkdirSync(target, { recursive: true });
for (const file of files) {
  copyFileSync(new URL(`assets/fonts/${file}`, root), resolve(target, file));
}
console.log(`copied ${files.size} fonts to ${target}`);
