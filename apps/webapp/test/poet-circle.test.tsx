import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PoetCircle } from "../components/library/PoetCircle";
import type { LibraryPoet } from "../lib/library/models";
import type { PoetPictureEntry } from "../lib/library/pictures";

let pictures: Record<string, PoetPictureEntry> = {};
vi.mock("../lib/library/browser", () => ({ usePictures: () => pictures }));

const hafez = { id: 1, slug: "hafez", name: "حافظ", tag: "", color: "lapis", bio: "" } as unknown as LibraryPoet;
const entry = (version: string): PoetPictureEntry => ({ slug: "hafez", version, url: `/v1/poets/hafez/picture?v=${version}` });
const circle = () => screen.getByTestId("circle-hafez");
const images = () => [...circle().querySelectorAll("img")];
const srcs = () => images().map((image) => image.getAttribute("src"));
const visible = () => images().filter((image) => image.className.includes("opacity-100")).map((image) => image.getAttribute("src"));

/** jsdom loads no image: a test says which pictures the browser already has. */
let cached = new Set<string>();
beforeEach(() => {
  pictures = {};
  cached = new Set();
  Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get() { return cached.has(this.getAttribute("src")); } });
  Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", { configurable: true, get() { return cached.has(this.getAttribute("src")) ? 1 : 0; } });
});
afterEach(() => {
  Reflect.deleteProperty(HTMLImageElement.prototype, "complete");
  Reflect.deleteProperty(HTMLImageElement.prototype, "naturalWidth");
});

describe("PoetCircle", () => {
  it("shows the letter of a poet without a picture", () => {
    render(<PoetCircle poet={hafez} />);
    expect(circle()).toHaveTextContent("ح");
    expect(images()).toHaveLength(0);
  });

  it("shows the letter until the picture has loaded, then the picture instead of it", () => {
    pictures = { hafez: entry("a") };
    render(<PoetCircle poet={hafez} />);
    expect(circle()).toHaveTextContent("ح");
    expect(visible()).toEqual([]);
    fireEvent.load(images()[0]!);
    expect(circle()).not.toHaveTextContent("ح");
    expect(visible()).toEqual(["/api/v1/poets/hafez/picture?v=a"]);
  });

  it("keeps the letter when the picture fails to load", () => {
    pictures = { hafez: entry("a") };
    render(<PoetCircle poet={hafez} />);
    fireEvent.error(images()[0]!);
    expect(circle()).toHaveTextContent("ح");
    expect(visible()).toEqual([]);
  });

  it("shows a picture the browser already has at once: no letter, no fade", () => {
    cached.add("/api/v1/poets/hafez/picture?v=a");
    pictures = { hafez: entry("a") };
    render(<PoetCircle poet={hafez} />);
    expect(circle()).not.toHaveTextContent("ح");
    expect(visible()).toEqual(["/api/v1/poets/hafez/picture?v=a"]);
    expect(images()[0]!.className).not.toContain("transition");
  });

  it("fades in a picture that was still loading", () => {
    pictures = { hafez: entry("a") };
    render(<PoetCircle poet={hafez} />);
    expect(images()[0]!.className).toContain("transition-opacity");
  });

  it("keeps the old picture until the new version has loaded, and for good when the new one fails", () => {
    pictures = { hafez: entry("a") };
    const { rerender } = render(<PoetCircle poet={hafez} />);
    fireEvent.load(images()[0]!);
    pictures = { hafez: entry("b") };
    rerender(<PoetCircle poet={hafez} />);
    expect(circle()).not.toHaveTextContent("ح");
    expect(srcs()).toEqual(["/api/v1/poets/hafez/picture?v=a", "/api/v1/poets/hafez/picture?v=b"]);
    expect(visible()).toEqual(["/api/v1/poets/hafez/picture?v=a"]);
    fireEvent.error(images()[1]!);
    expect(circle()).not.toHaveTextContent("ح");
    expect(visible()).toEqual(["/api/v1/poets/hafez/picture?v=a"]);
    // A third version that does load replaces the old one.
    pictures = { hafez: entry("c") };
    rerender(<PoetCircle poet={hafez} />);
    fireEvent.load(images().find((image) => image.getAttribute("src")!.endsWith("v=c"))!);
    expect(srcs()).toEqual(["/api/v1/poets/hafez/picture?v=c"]);
    expect(visible()).toEqual(["/api/v1/poets/hafez/picture?v=c"]);
  });
});
