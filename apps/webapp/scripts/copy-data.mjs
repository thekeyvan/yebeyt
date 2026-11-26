// Copies the bundled poetry data (the .json files tools/ganjoor/build.py writes into the iOS app) into public/data (not committed), so the
// browser reads them from our own domain: poets.json, the bundled books, the indexes and the game deck. The web app and iOS share one source.
// Usage (from the app's folder): node scripts/copy-data.mjs [target folder]
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const source = new URL("../../ios/Yebeyt/Resources/Data/", import.meta.url);
const target = resolve(process.argv[2] ?? "public/data");
const files = readdirSync(source).filter((name) => name.endsWith(".json"));

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const name of files) copyFileSync(new URL(name, source), resolve(target, name));
console.log(`copied ${files.length} data files to ${target}`);
