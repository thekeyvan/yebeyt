import { describe, expect, it } from "vitest";
import { frame, pieces, type BurstAction } from "../lib/burst";
import { bursts, coverAway, coverDrop, coverRise, popKeyframes, spring, turningOff, turningOn } from "../lib/motion";

describe("burst pieces (Design/Burst.swift)", () => {
  it("gives each action its own kind of piece, tint and count", () => {
    const like = pieces("like", 1);
    expect(like.length).toBeGreaterThanOrEqual(4);
    expect(like.length).toBeLessThanOrEqual(6);
    expect(new Set(like.map((piece) => piece.kind))).toEqual(new Set(["heart"]));
    expect(like.every((piece) => piece.tint === "fire" || piece.tint === "magenta")).toBe(true);
    const keep = pieces("keep", 1);
    expect(keep.every((piece) => piece.kind === "ribbon" && piece.tint === "lapis")).toBe(true);
    expect(keep.length).toBeGreaterThanOrEqual(3);
    expect(keep.length).toBeLessThanOrEqual(4);
    const repost = pieces("repost", 1);
    expect(repost.map((piece) => piece.kind)).toEqual(["arrow", "arrow"]);
  });

  it("gives a send none: its icon flies off and lands back", () => {
    expect(pieces("send", 1)).toEqual([]);
  });

  it("makes the same burst from the same seed and another from another", () => {
    expect(pieces("like", 7)).toEqual(pieces("like", 7));
    expect(pieces("like", 7)).not.toEqual(pieces("like", 8));
  });

  it("keeps every piece's angle on the circle, and its size and distance near the style's", () => {
    for (const action of ["like", "keep", "repost"] as BurstAction[]) {
      for (let seed = 0; seed < 50; seed++) {
        for (const piece of pieces(action, seed)) {
          expect(piece.angle).toBeGreaterThanOrEqual(0);
          expect(piece.angle).toBeLessThan(2 * Math.PI);
          expect(piece.distance).toBeGreaterThan(20);
          expect(piece.distance).toBeLessThanOrEqual(46);
          expect(piece.size).toBeGreaterThan(8);
          expect(piece.size).toBeLessThan(17);
        }
      }
    }
  });

  it("fans a keep and a like upward, and circles a repost", () => {
    for (const piece of [...pieces("keep", 3), ...pieces("like", 3)]) expect(Math.sin(piece.angle)).toBeLessThan(0.1);
    expect(pieces("repost", 3).every((piece) => piece.flight === "orbit")).toBe(true);
  });
});

describe("a piece's frames", () => {
  const [piece] = pieces("keep", 5);

  it("is not there at the start or the end, and fully there in the middle of the flight", () => {
    expect(frame(piece!, 0).opacity).toBe(0);
    expect(frame(piece!, 1).opacity).toBe(0);
    expect(frame(piece!, 0.3).opacity).toBe(1);
  });

  it("flies out fast and slows down, fading in the second half and shrinking to a half", () => {
    const distance = (progress: number) => Math.hypot(frame(piece!, progress).dx, frame(piece!, progress).dy);
    expect(distance(0.5)).toBeGreaterThan(distance(0.25));
    expect(distance(0.5)).toBeGreaterThan(0.8 * piece!.distance);
    expect(frame(piece!, 0.7).opacity).toBeLessThan(1);
    expect(frame(piece!, 0.99).scale).toBeCloseTo(0.5, 1);
    expect(frame(piece!, 0.2).scale).toBe(1);
  });
});

describe("the pop of an icon", () => {
  it("turns each action's icon its own way", () => {
    expect(Object.keys(turningOn("like", "full"))).toEqual(["scale", "rotate"]);
    expect(turningOn("keep", "full").y?.[0]).toEqual([-18, 0.01]);
    expect(turningOn("repost", "full").rotate).toEqual([[360, 0.45]]);
    expect(Object.keys(turningOn("send", "full")).sort()).toEqual(["opacity", "scale", "x", "y"]);
  });

  it("is a short scale for all under Reduce Motion, and still when taken off", () => {
    for (const action of ["like", "keep", "repost", "send"] as const) expect(turningOn(action, "reduced")).toEqual({ scale: [[1.05, 0.1], [1, 0.1]] });
    expect(turningOff("full")).toEqual({ scale: [[1.15, 0.12], [0.95, 0.1], [1, 0.08]] });
    expect(turningOff("reduced")).toEqual(turningOn("like", "reduced"));
  });

  it("is played as keyframes from rest, each property over its own seconds", () => {
    const { keyframes, transition, duration } = popKeyframes(turningOn("like", "full"));
    expect(keyframes.scale).toEqual([1, 1.35, 0.9, 1.05, 1]);
    expect(keyframes.rotate).toEqual([0, 8, -8, 4, 0]);
    expect(duration).toBeCloseTo(0.45, 5);
    const times = (transition.scale as { times: number[] }).times;
    expect(times[0]).toBe(0);
    expect(times.at(-1)).toBeCloseTo(1, 5);
    expect(times[1]).toBeCloseTo(0.12 / 0.45, 5);
  });

  it("makes particles only for an action that has some, and not under Reduce Motion", () => {
    expect([bursts("like", "full"), bursts("keep", "full"), bursts("repost", "full"), bursts("send", "full")]).toEqual([true, true, true, false]);
    expect(bursts("like", "reduced")).toBe(false);
  });
});

describe("the cover (Motion.coverRise, coverDrop)", () => {
  it("rises with a firm spring (0.4, 0.9) and drops quickly (0.25, 1)", () => {
    expect(coverRise("full")).toEqual(spring(0.4, 0.9));
    expect(coverDrop("full")).toEqual(spring(0.25, 1));
  });

  it("waits a screen's height down, and under Reduce Motion stays and fades, quickly", () => {
    expect(coverAway("full")).toEqual({ y: "100%", opacity: 1 });
    expect(coverAway("reduced")).toEqual({ y: "0%", opacity: 0 });
    expect(coverRise("reduced")).toEqual({ duration: 0.1, ease: "easeOut" });
  });
});
