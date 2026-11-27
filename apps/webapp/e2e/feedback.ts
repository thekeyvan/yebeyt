import { expect, type Page } from "@playwright/test";

/** How each ask the page makes to the door for feedback is answered (the server is not there: the test is the server). */
export type Behaviour = { report?: "ok" | "offline" | "rate" | "broken"; upload?: "ok" | "busy" | "too-big" };
/** What the page sent: the method, the address, the type and upload token it set, and the body. */
export type Seen = { method: string; path: string; type?: string; token?: string; body: Buffer };

const id = "6f1c2a52-0d0b-4a9e-8a52-3f3b1a2f9c11";

type Asked = { method: string; path: string; type?: string; token?: string; body: string };
type Answer = { offline: true } | { status: number; headers?: Record<string, string>; json?: unknown };

/**
 * Answers the page's asks to `/api/v1/feedback…` itself, inside the page (its `fetch` is wrapped), so that what was sent (the bodies of files too, which the browsers do not
 * all show to a test) is seen the same in every browser. Set it up before the page opens; `behaviour` can be changed while the test runs.
 */
export async function feedbackServer(page: Page, behaviour: Behaviour = {}) {
  const seen: Seen[] = [];
  const answer = ({ method }: Asked): Answer => {
    if (method === "POST") {
      switch (behaviour.report ?? "ok") {
        case "offline":
          return { offline: true };
        case "rate":
          return { status: 429, json: { error: "rate_limited" } };
        case "broken":
          return { status: 500, json: { error: "internal_error" } };
        case "ok":
          return { status: 201, json: { id, uploadToken: "tok_1-A" } };
      }
    }
    if (behaviour.upload === "busy") return { status: 503, headers: { "retry-after": "1" }, json: { error: "busy" } };
    if (behaviour.upload === "too-big") return { status: 413, json: { error: "payload_too_large" } };
    return { status: 204 };
  };
  await page.exposeFunction("beytFeedbackAsked", (asked: Asked): Answer => {
    seen.push({ method: asked.method, path: asked.path.replace(id, "<id>"), type: asked.type, token: asked.token, body: Buffer.from(asked.body, "base64") });
    return answer(asked);
  });
  await page.addInitScript(() => {
    const real = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const path = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
      if (!path.startsWith("/api/v1/feedback")) return real(input, init);
      const headers = new Headers(init?.headers);
      const raw = init?.body instanceof Blob ? new Uint8Array(await init.body.arrayBuffer()) : new TextEncoder().encode(typeof init?.body === "string" ? init.body : "");
      let body = "";
      for (let at = 0; at < raw.length; at += 8192) body += String.fromCharCode(...raw.subarray(at, at + 8192));
      const answered = await (window as unknown as { beytFeedbackAsked: (asked: unknown) => Promise<Answer> }).beytFeedbackAsked({
        method: init?.method ?? "GET",
        path,
        type: headers.get("content-type") ?? undefined,
        token: headers.get("x-upload-token") ?? undefined,
        body: btoa(body),
      });
      if ("offline" in answered) throw new TypeError("Failed to fetch");
      return new Response(answered.json === undefined ? null : JSON.stringify(answered.json), { status: answered.status, headers: answered.headers });
    };
  });
  return {
    behaviour,
    seen,
    reports: () => seen.filter((call) => call.path === "/api/v1/feedback"),
    uploads: (kind: "screenshot" | "recording") => seen.filter((call) => call.path === `/api/v1/feedback/<id>/${kind}`),
    /** The JSON the report carried. */
    json: (index = 0) => JSON.parse(seen.filter((call) => call.path === "/api/v1/feedback")[index]!.body.toString("utf8")) as Record<string, unknown>,
  };
}

export const choices = (page: Page) => page.getByRole("dialog", { name: "می‌خوای چیزی بگی؟" });
export const form = (page: Page, title: string) => page.getByRole("dialog", { name: title });

/** Opens the sheet of choices with the keyboard (Shift and the «?» key) and waits for it (a page that has only just loaded may not be listening yet: the key is pressed again until it is). */
export async function openByKeyboard(page: Page) {
  await expect(async () => {
    await page.keyboard.press("Shift+Slash");
    await expect(choices(page)).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
}

/** Opens the sheet by the keyboard and picks a type: the form is up, with the screenshot taken. */
export async function openForm(page: Page, type: "bug" | "annoyed" | "idea" | "game" | "liked", title: string) {
  await openByKeyboard(page);
  await page.getByTestId(`feedback-type-${type}`).click();
  await expect(form(page, title)).toBeVisible();
}

export const titles = { bug: "باگ دیدم", annoyed: "یه جاش اذیتم کرد", idea: "یه ایده دارم", game: "یه بازی پیشنهاد بده", liked: "خوشم اومد" } as const;

/** The screenshot as the form shows it: the PNG that was taken (and marked), read back through a canvas. */
export async function thumbnail(page: Page): Promise<Buffer> {
  const data = await page.evaluate(async () => {
    const img = document.querySelector<HTMLImageElement>("[data-testid=feedback-thumbnail]")!;
    await img.decode();
    const canvas = Object.assign(document.createElement("canvas"), { width: img.naturalWidth, height: img.naturalHeight });
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png").split(",")[1]!;
  });
  return Buffer.from(data, "base64");
}

/** Decodes an image in the page: its size, how many different colours it has, and the pixel at each of `at` (fractions of its width and height). */
export function inspect(page: Page, bytes: Buffer, at: [number, number][] = []) {
  return page.evaluate(
    async ({ data, points }) => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))]));
      const canvas = Object.assign(document.createElement("canvas"), { width: bitmap.width, height: bitmap.height });
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      const colours = new Set<number>();
      for (let i = 0; i < pixels.length; i += 4) colours.add(((pixels[i]! >> 3) << 10) | ((pixels[i + 1]! >> 3) << 5) | (pixels[i + 2]! >> 3));
      const pixel = ([x, y]: [number, number]) => {
        const at = (Math.floor(y * bitmap.height) * bitmap.width + Math.floor(x * bitmap.width)) * 4;
        return [pixels[at]!, pixels[at + 1]!, pixels[at + 2]!];
      };
      return { width: bitmap.width, height: bitmap.height, colours: colours.size, pixels: points.map(pixel) };
    },
    { data: bytes.toString("base64"), points: at },
  );
}
