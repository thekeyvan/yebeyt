import { expect, test } from "@playwright/test";

// `heading` is the page's own title: the home's is «بیتِ امروز», as on the phone, where «خونه» is only the tab.
const tabs = [
  { title: "خونه", href: "/", heading: "بیتِ امروز" },
  { title: "کاوش", href: "/explore", heading: "کاوش" },
  { title: "بازی", href: "/games", heading: "بازی" },
  { title: "پیام‌ها", href: "/messages", heading: "پیام‌ها" },
  { title: "من", href: "/me", heading: "من" },
];

const lapis = "rgb(47, 53, 245)";

test("the page is right-to-left and never scrolls sideways", async ({ page }) => {
  for (const { href } of tabs) {
    await page.goto(href);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "fa");
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, href).toBeLessThanOrEqual(clientWidth);
  }
});

test("the five tabs navigate, and the open one is marked and lapis", async ({ page }) => {
  await page.goto("/");
  const bar = page.getByRole("navigation", { name: "تب‌ها" });
  await expect(bar.getByRole("link")).toHaveText(tabs.map((tab) => tab.title));

  for (const { title, href, heading } of tabs) {
    await bar.getByRole("link", { name: title }).click();
    // A guest meets the gate on پیام‌ها (its chats need an account): «بعداً» puts it away.
    if (href === "/messages") {
      await page.getByRole("button", { name: "بعداً" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await expect(page).toHaveURL((url) => url.pathname === href);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    const open = bar.getByRole("link", { name: title });
    await expect(open).toHaveAttribute("aria-current", "page");
    await expect(open).toHaveCSS("color", lapis);
    await expect(bar.locator("[aria-current]")).toHaveCount(1);
  }
});

test("the tabs sit right to left: خونه is first from the right, or at the top of the rail", async ({ page }) => {
  await page.goto("/");
  const bar = page.getByRole("navigation", { name: "تب‌ها" });
  const boxes = await Promise.all(tabs.map(async ({ title }) => (await bar.getByRole("link", { name: title }).boundingBox())!));
  if (page.viewportSize()!.width >= 1024) {
    for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.y);
  } else {
    for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.x).toBeLessThan(boxes[i - 1]!.x);
  }
});

test("the bar is a rail on the right from 1024 px, and under it on a phone", async ({ page }) => {
  await page.goto("/");
  const { width, height } = page.viewportSize()!;
  const box = (await page.getByRole("navigation", { name: "تب‌ها" }).boundingBox())!;
  if (width >= 1024) {
    expect(box.x + box.width).toBeGreaterThan(width - 40);
    expect(box.height).toBeGreaterThan(box.width);
  } else {
    expect(box.y + box.height).toBeLessThanOrEqual(height - 18);
    expect(box.width).toBeGreaterThan(width - 40);
    expect(box.height).toBe(70);
  }
});

test("the bar never covers the last item of a long list", async ({ page }) => {
  await page.goto("/dev/stickers");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const last = page.locator("#last-item");
  await expect(last).toBeInViewport();
  const item = (await last.boundingBox())!;
  const bar = (await page.getByRole("navigation", { name: "تب‌ها" }).boundingBox())!;
  const overlaps = item.x < bar.x + bar.width && bar.x < item.x + item.width && item.y < bar.y + bar.height && bar.y < item.y + item.height;
  expect(overlaps).toBe(false);
});

test("the header stays at the top while the page scrolls", async ({ page }) => {
  await page.goto("/dev/stickers");
  await page.evaluate(() => window.scrollTo(0, 600));
  const header = page.getByRole("heading", { level: 1 });
  await expect(header).toBeInViewport();
  expect((await header.boundingBox())!.y).toBeLessThan(40);
});

test("a tab's page slides in from the side of its tab and does not fade", async ({ page }) => {
  await page.goto("/");
  const bar = page.getByRole("navigation", { name: "تب‌ها" });
  const first = (async () => {
    // The page is wrapped by the element that moves; read its transform and opacity on the first frames after the click.
    return page.evaluate(
      () =>
        new Promise<{ x: number; opacity: string }>((resolve) => {
          const watch = new MutationObserver(() => {
            const moving = document.querySelector<HTMLElement>("div.overflow-x-clip > div");
            if (moving?.style.transform && moving.style.transform !== "none") {
              watch.disconnect();
              resolve({ x: new DOMMatrix(getComputedStyle(moving).transform).m41, opacity: getComputedStyle(moving).opacity });
            }
          });
          watch.observe(document.body, { subtree: true, childList: true, attributes: true });
        }),
    );
  })();
  await bar.getByRole("link", { name: "کاوش" }).click();
  const { x, opacity } = await first;
  // کاوش is the tab after خونه, so at the left in right-to-left: its page comes from the left.
  expect(x).toBeLessThan(0);
  expect(opacity).toBe("1");
});
