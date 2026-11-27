import { colors } from "../tokens";
import { blankPrivate } from "./privacy";
import { drawMarks, type Mark } from "./markup";

/** The picture that is sent: a JPEG of about 0.8 quality, at most 1600 pixels on its long side and under the server's 3 MB (ScreenshotEncoder in Screenshot.swift). */
export const longSide = 1600;
export const maxBytes = 3_000_000;

/** `width`×`height` scaled down to `limit` on its long side, never enlarged; undefined for a picture with nothing in it. */
export function fitSize(width: number, height: number, limit = longSide): { width: number; height: number } | undefined {
  const shrink = Math.min(1, limit / Math.max(width, height));
  const fitted = { width: Math.round(width * shrink), height: Math.round(height * shrink) };
  return fitted.width >= 1 && fitted.height >= 1 ? fitted : undefined;
}

const canvasBlob = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/** `picture` as a JPEG within the limits; undefined when it can't be made small enough (it is not sent big). */
export async function toJpeg(picture: Blob, limit = longSide, size = maxBytes): Promise<Blob | undefined> {
  const bitmap = await createImageBitmap(picture);
  const target = fitSize(bitmap.width, bitmap.height, limit);
  if (!target) return undefined;
  const canvas = Object.assign(document.createElement("canvas"), target);
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.fillStyle = colors.paper; // a JPEG has no see-through parts
  context.fillRect(0, 0, target.width, target.height);
  context.drawImage(bitmap, 0, 0, target.width, target.height);
  for (let quality = 0.8; quality > 0.2; quality -= 0.2) {
    const jpeg = await canvasBlob(canvas, "image/jpeg", quality);
    if (jpeg && jpeg.size <= size) return jpeg;
  }
  return undefined;
}

/** `picture` with the editor's marks drawn on it: the same size, a PNG. */
export async function withMarks(picture: Blob, marks: readonly Mark[]): Promise<Blob | undefined> {
  const bitmap = await createImageBitmap(picture);
  const canvas = Object.assign(document.createElement("canvas"), { width: bitmap.width, height: bitmap.height });
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.drawImage(bitmap, 0, 0);
  drawMarks(context, marks, bitmap.width, bitmap.height);
  return (await canvasBlob(canvas, "image/png")) ?? undefined;
}

const pinned = "data-feedback-pin";

type Pin = { left: number; top: number; width: number; height: number };

/** The elements that stay where they are while the page scrolls (fixed, or stuck as they are while it scrolls): each is marked for the copy, with where it is drawn now. */
function pinThings(): Pin[] {
  const pins: Pin[] = [];
  for (const element of document.body.querySelectorAll<HTMLElement>("*")) {
    const position = getComputedStyle(element).position;
    if ((position !== "fixed" && position !== "sticky") || element.parentElement?.closest(`[${pinned}]`)) continue;
    const { left, top, width, height } = element.getBoundingClientRect();
    element.setAttribute(pinned, String(pins.length));
    pins.push({ left, top, width, height });
  }
  return pins;
}

const unpin = (): void => document.querySelectorAll(`[${pinned}]`).forEach((element) => element.removeAttribute(pinned));

/**
 * The page as the copy that is drawn must have it: the page is scrolled (its content moves up, and what is pinned to the screen is put where it is drawn now, straight
 * under the page's top) and the private views are blank.
 */
function arrange(copy: HTMLElement, pins: readonly Pin[], scrolled: number): void {
  copy.style.setProperty("position", "relative", "important");
  copy.style.setProperty("top", `${-scrolled}px`, "important");
  copy.style.setProperty("isolation", "isolate", "important"); // what is pinned at the back (the dots) stays in front of the page's own colour
  for (const element of copy.querySelectorAll<HTMLElement>(`[${pinned}]`)) {
    const pin = pins[Number(element.getAttribute(pinned))];
    if (!pin) continue;
    element.removeAttribute(pinned);
    for (const [name, value] of Object.entries({ position: "absolute", left: `${pin.left}px`, top: `${pin.top + scrolled}px`, width: `${pin.width}px`, height: `${pin.height}px`, right: "auto", bottom: "auto", margin: "0", transform: "none", "box-sizing": "border-box" })) {
      element.style.setProperty(name, value, "important");
    }
    copy.appendChild(element);
  }
  blankPrivate(copy);
}

/** How long drawing the page may take before the report goes without a picture. */
const timeoutMs = 6000;

/**
 * The picture of the page as it is now (the part in the window), taken just before the feedback sheet opens: a PNG, or undefined when the browser can't draw it.
 * Every private view (`lib/feedback/privacy.ts`) is blank in it, and a picture from another site that can't be read is left empty, so the picture is never tainted.
 */
export async function capturePage(): Promise<Blob | undefined> {
  try {
    const { domToCanvas } = await import("modern-screenshot"); // only when it is wanted
    const pins = pinThings();
    const canvas = await domToCanvas(document.body, {
      width: document.documentElement.clientWidth,
      height: window.innerHeight,
      scale: Math.min(window.devicePixelRatio || 1, 2),
      backgroundColor: colors.paper,
      timeout: timeoutMs,
      features: { restoreScrollPosition: true },
      onCloneNode: (copy) => arrange(copy as HTMLElement, pins, window.scrollY),
    });
    return (await canvasBlob(canvas, "image/png")) ?? undefined;
  } catch {
    return undefined;
  } finally {
    unpin();
  }
}
