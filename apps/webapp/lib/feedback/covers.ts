import { bindPersistentLayer } from "@ui-sdk/core";
import { colors } from "../tokens";
import { privateSelector } from "./privacy";

type Box = { left: number; top: number; right: number; bottom: number };

const boxOf = ({ left, top, right, bottom }: DOMRect): Box => ({ left, top, right, bottom });

/** The part both boxes hold, or undefined when there is none. */
export function intersect(a: Box, b: Box): Box | undefined {
  const box = { left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) };
  return box.right - box.left > 0 && box.bottom - box.top > 0 ? box : undefined;
}

/** How much of a colour is there: 0 for «transparent», the alpha of «rgba(…, a)» and of «color(srgb … / a)», else 1. */
export function alphaOf(color: string): number {
  if (color === "transparent") return 0;
  const alpha = /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/.exec(color)?.[1] ?? /\/\s*([\d.]+%?)\s*\)$/.exec(color)?.[1];
  if (alpha === undefined) return 1;
  return alpha.endsWith("%") ? parseFloat(alpha) / 100 : parseFloat(alpha);
}

/**
 * Whether what stands in front of `element` hides it: a solid surface (a game, the reader, a sheet) and not a dimming backdrop or a see-through layer. Going up from the
 * front, the first colour it finds says: opaque is a cover. It stops at what holds `element` too (a card with a see-through layer over its own text hides nothing).
 */
function isHiddenBy(front: Element, element: Element): boolean {
  if (element.contains(front)) return false;
  for (let node: Element | null = front; node && !node.contains(element); node = node.parentElement) {
    const alpha = alphaOf(getComputedStyle(node).backgroundColor);
    if (alpha > 0) return alpha >= 0.99;
  }
  return false;
}

/** Where the private view is drawn (the part of it in the window and not clipped by an ancestor), unless something solid is in front of all of it (every one of nine points over it: corners, edges, middle). */
function visibleBox(element: Element, view: Box): Box | undefined {
  let box = intersect(boxOf(element.getBoundingClientRect()), view);
  for (let up = element.parentElement; up && box; up = up.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(up);
    if (overflowX !== "visible" || overflowY !== "visible") box = intersect(box, boxOf(up.getBoundingClientRect()));
  }
  if (!box) return undefined;
  return samples(box).every(([x, y]) => {
    const front = document.elementFromPoint(x, y);
    return front !== null && isHiddenBy(front, element);
  })
    ? undefined
    : box;
}

/** Nine points of `box`: its corners and the middles of its edges (a pixel inside) and its middle. */
export function samples(box: Box): [number, number][] {
  const xs = [box.left + Math.min(1, (box.right - box.left) / 2), (box.left + box.right) / 2, box.right - Math.min(1, (box.right - box.left) / 2)];
  const ys = [box.top + Math.min(1, (box.bottom - box.top) / 2), (box.top + box.bottom) / 2, box.bottom - Math.min(1, (box.bottom - box.top) / 2)];
  return ys.flatMap((y) => xs.map((x): [number, number] => [x, y]));
}

/**
 * Covers every private view with a solid block while the screen is recorded (the covers of FeedbackPrivacy.swift): one block over each, kept where the view is drawn, every
 * frame, so scrolling, resizing, animations and new messages are all followed. It is on before the recording starts and off after it has stopped; answers the way to switch it off.
 * The layer is in the browser's top layer, as the sheets are, so a private view in a sheet is covered too.
 */
export function startCovers(): () => void {
  const layer = document.createElement("div");
  layer.setAttribute("data-feedback-covers", "");
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("popover", "manual");
  layer.style.cssText = "position:fixed;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;background:transparent;pointer-events:none;overflow:hidden;z-index:9000";
  document.body.appendChild(layer);
  layer.showPopover?.(); // a browser with no popovers has the z-index above
  const release = bindPersistentLayer(layer);
  let frame = 0;
  const place = () => {
    const view = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    const boxes = [...document.querySelectorAll(privateSelector)].flatMap((element) => visibleBox(element, view) ?? []);
    while (layer.children.length > boxes.length) layer.lastElementChild!.remove();
    while (layer.children.length < boxes.length) {
      const cover = document.createElement("div");
      cover.setAttribute("data-testid", "feedback-cover");
      cover.style.cssText = `position:absolute;background:${colors.trackLight};border-radius:min(14px,50%)`;
      layer.appendChild(cover);
    }
    boxes.forEach((box, index) => {
      const { style } = layer.children[index] as HTMLElement;
      style.left = `${box.left}px`;
      style.top = `${box.top}px`;
      style.width = `${box.right - box.left}px`;
      style.height = `${box.bottom - box.top}px`;
    });
    frame = requestAnimationFrame(place);
  };
  place();
  return () => {
    cancelAnimationFrame(frame);
    release();
    layer.remove();
  };
}
