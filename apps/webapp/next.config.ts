import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** The build's git sha, which is the app's version in a feedback report: Railway's variable (named in the Dockerfile so it reaches the build), else the checkout's own, else «dev». */
function buildVersion(): string {
  const railway = process.env.RAILWAY_GIT_COMMIT_SHA;
  if (railway) return railway.slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || "dev";
  } catch {
    return "dev";
  }
}

const config: NextConfig = {
  output: "standalone",
  // Another folder for a second build next to the first (the end-to-end test of a production build made without the debug pages).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The workspace root, so the standalone build traces files of the packages next to the app.
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  poweredByHeader: false,
  // The face is drawn by a TypeScript package of the workspace, which Next compiles with the app.
  transpilePackages: ["@yebeyt/avatar"],
  // The debug switch is decided when the app is built, for the server's code as well as the page's: a variable set later on the running server cannot turn the debug pages
  // or the debug sign-in on (`lib/dev.ts`).
  env: { NEXT_PUBLIC_DEV_PAGES: process.env.NEXT_PUBLIC_DEV_PAGES ?? "", NEXT_PUBLIC_BUILD: buildVersion() },
};

export default config;
