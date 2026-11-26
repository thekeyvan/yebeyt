import { defineConfig, devices } from "@playwright/test";

// The tests run against the production build (`next build && next start`) on a fixed port; E2E_PORT picks another.
// A port chosen from the system before the build could be taken by something else before the server starts.
process.env.E2E_PORT ??= "4173";
const port = Number(process.env.E2E_PORT);

const sizes = [
  { name: "375", viewport: { width: 375, height: 667 }, phone: true },
  { name: "390", viewport: { width: 390, height: 844 }, phone: true },
  { name: "1280", viewport: { width: 1280, height: 800 }, phone: false },
];

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: `http://localhost:${port}`, locale: "fa-IR" },
  webServer: {
    command: `pnpm build && pnpm exec next start -p ${port}`,
    url: `http://localhost:${port}`,
    timeout: 240_000,
    // The debug pages (/dev/stickers) are only in a build made with this.
    env: { NEXT_PUBLIC_DEV_PAGES: "1" },
  },
  projects: (["chromium", "webkit"] as const).flatMap((browser) =>
    sizes.map(({ name, viewport, phone }) => ({
      name: `${browser}-${name}`,
      use: {
        ...devices[browser === "chromium" ? "Desktop Chrome" : "Desktop Safari"],
        viewport,
        hasTouch: phone,
        isMobile: phone,
      },
    })),
  ),
});
