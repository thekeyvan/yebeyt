import { describe, expect, it } from "vitest";
import { bouncy, press, pressedScale, pressTransition, pop, settle, slideFrom, spring, tabSlide, toastArrival, variant } from "../lib/motion";

describe("springs", () => {
  it("turn an iOS response and damping into Motion's stiffness and damping", () => {
    const { stiffness, damping } = spring(0.35, 0.55);
    expect(stiffness).toBeCloseTo((2 * Math.PI / 0.35) ** 2, 6);
    expect(damping).toBeCloseTo(2 * 0.55 * (2 * Math.PI / 0.35), 6);
  });

  it("are the values of Motion.swift", () => {
    expect(bouncy).toEqual(spring(0.35, 0.55));
    expect(press).toEqual(spring(0.3, 0.5));
  });
});

describe("reduced motion", () => {
  it("picks the variant", () => {
    expect(variant(false)).toBe("full");
    expect(variant(true)).toBe("reduced");
  });

  it("squishes a pressed button to 0.92, and only to 0.97 when reduced", () => {
    expect(pressedScale("full")).toBe(0.92);
    expect(pressedScale("reduced")).toBe(0.97);
  });

  it("drops a toast in from 28 above at 0.9, and not at all when reduced", () => {
    expect(toastArrival("full")).toEqual({ y: -28, scale: 0.9 });
    expect(toastArrival("reduced")).toEqual({ y: 0, scale: 1 });
  });
});

describe("transitions", () => {
  it("are the springs, and plain quick moves under Reduce Motion", () => {
    expect(settle("full")).toBe(bouncy);
    expect(pressTransition("full")).toBe(press);
    for (const transition of [settle("reduced"), pressTransition("reduced")]) {
      expect(transition).toEqual({ duration: 0.1, ease: "easeOut" });
    }
  });
});

describe("pop", () => {
  it("goes 1 → 1.35 → 0.9 → 1.05 → 1 over 0.45 s", () => {
    const { scale, times, duration } = pop("full");
    expect(scale).toEqual([1, 1.35, 0.9, 1.05, 1]);
    expect(duration).toBe(0.45);
    expect(times).toHaveLength(scale.length);
    expect(times[0]).toBe(0);
    expect(times.at(-1)).toBe(1);
  });

  it("is a short scale to 1.05 under Reduce Motion, well inside 0.15 s", () => {
    const { scale, duration } = pop("reduced");
    expect(scale).toEqual([1, 1.05, 1]);
    expect(duration).toBeLessThanOrEqual(0.15);
  });
});

describe("slideFrom", () => {
  it("comes from the side of the new tab: later tabs are on the left in right-to-left", () => {
    expect(tabSlide).toBe(40);
    expect(slideFrom(0, 1, true, "full")).toBe(-40);
    expect(slideFrom(1, 0, true, "full")).toBe(40);
    expect(slideFrom(0, 1, false, "full")).toBe(40);
    expect(slideFrom(1, 0, false, "full")).toBe(-40);
  });

  it("stays put with no change, no earlier page, or reduced motion", () => {
    expect(slideFrom(2, 2, true, "full")).toBe(0);
    expect(slideFrom(null, 2, true, "full")).toBe(0);
    expect(slideFrom(0, 1, true, "reduced")).toBe(0);
  });
});
