import { readFileSync } from "node:fs";
import { join } from "node:path";

// Vitest runs from apps/webapp.
const bundledFolder = join(process.cwd(), "../ios/Yebeyt/Resources/Data");

/** A JSON file of the bundled poetry data (the files the web app copies into /data). */
export const bundledFile = <T>(name: string): T => JSON.parse(readFileSync(join(bundledFolder, `${name}.json`), "utf8")) as T;

/** A file saved in test/fixtures. */
export const fixtureText = (name: string): string => readFileSync(join(process.cwd(), "test/fixtures", name), "utf8");

export const fixture = <T>(name: string): T => JSON.parse(fixtureText(`${name}.json`)) as T;
