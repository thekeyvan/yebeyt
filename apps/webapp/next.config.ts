import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

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
  env: { NEXT_PUBLIC_DEV_PAGES: process.env.NEXT_PUBLIC_DEV_PAGES ?? "" },
};

export default config;
