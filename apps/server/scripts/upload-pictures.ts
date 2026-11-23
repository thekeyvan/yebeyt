import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { knownPoetSlugs, planUploads, renderPicture } from "./pictures.js";

// Usage: API_URL=<server> ADMIN_TOKEN=<token> pnpm --filter @yebeyt/server pictures:upload <dir> [--dry-run]
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dir = args.find((a) => !a.startsWith("--"));
const apiUrl = process.env.API_URL?.replace(/\/+$/, "");
const adminToken = process.env.ADMIN_TOKEN;

if (!dir || (!dryRun && (!apiUrl || !adminToken))) {
  console.error("Usage: API_URL=<server url> ADMIN_TOKEN=<token> pictures:upload <dir> [--dry-run]");
  process.exit(2);
}

// pnpm runs scripts from apps/server; INIT_CWD is where the command was typed.
const folder = resolve(process.env.INIT_CWD ?? process.cwd(), dir);
const plan = planUploads(readdirSync(folder), knownPoetSlugs());

let failed = 0;
for (const { file, slug } of plan.uploads) {
  const picture = await renderPicture(readFileSync(join(folder, file)));
  if (dryRun) {
    console.log(`would upload ${file} → ${slug} (${picture.bytes.length} bytes)`);
    continue;
  }
  const res = await fetch(`${apiUrl}/v1/admin/poets/${slug}/picture?width=${picture.width}&height=${picture.height}`, {
    method: "PUT",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": picture.contentType },
    body: picture.bytes,
  });
  if (res.ok) console.log(`uploaded ${file} → ${slug}`);
  else {
    failed++;
    console.error(`FAILED ${file} → ${slug}: HTTP ${res.status}`);
  }
}
for (const { file, reason } of plan.skipped) console.log(`skipped ${file}: ${reason}`);
console.log(`${plan.uploads.length - failed} done, ${plan.skipped.length} skipped, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
