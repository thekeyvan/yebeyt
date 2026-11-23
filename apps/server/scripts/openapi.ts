import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderOpenApi } from "../src/openapi.js";

const target = fileURLToPath(new URL("../../../packages/api/openapi.json", import.meta.url));
const fresh = renderOpenApi();

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(target, "utf8");
  } catch {
    // a missing file counts as stale
  }
  if (current !== fresh) {
    console.error("packages/api/openapi.json is out of date. Run: pnpm --filter @yebeyt/server api:generate");
    process.exit(1);
  }
  console.log("packages/api/openapi.json is up to date.");
} else {
  writeFileSync(target, fresh);
  console.log("Wrote packages/api/openapi.json");
}
