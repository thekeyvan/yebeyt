import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom has no Web Animations; UI SDK asks an element for its running animations before it removes it.
Element.prototype.getAnimations = () => [];

// …nor ResizeObserver, which the sheet uses to follow its size.
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom has no media queries: every query is false (a phone), and a test can change that.
window.matchMedia = vi.fn((media: string) => ({
  media,
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof window.matchMedia;

afterEach(cleanup);
