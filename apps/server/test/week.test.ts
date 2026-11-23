import { describe, expect, it } from "vitest";
import { previousWeek, tehranDate, weekEnd, weekOf, weekStart } from "../src/week.js";

describe("Tehran dates", () => {
  it("moves the day at 20:30 UTC (Tehran midnight, no daylight saving)", () => {
    expect(tehranDate(new Date("2026-11-20T20:29:59.999Z"))).toBe("2026-11-20");
    expect(tehranDate(new Date("2026-11-20T20:30:00Z"))).toBe("2026-11-21");
    expect(tehranDate(new Date("2026-06-01T12:00:00Z"))).toBe("2026-06-01");
    expect(tehranDate(new Date("2026-07-15T20:30:00Z"))).toBe("2026-07-16"); // summer too
  });
});

describe("Tehran week ids (Saturday to Friday)", () => {
  it("starts a new week on Saturday at Tehran midnight", () => {
    expect(weekOf(new Date("2026-11-20T20:29:59Z"))).toBe("2026-W47"); // Friday 23:59 in Tehran
    expect(weekOf(new Date("2026-11-20T20:30:00Z"))).toBe("2026-W48"); // Saturday 00:00
    expect(weekOf(new Date("2026-11-24T00:10:00Z"))).toBe("2026-W48"); // Tuesday
    expect(weekOf(new Date("2026-11-27T20:29:59Z"))).toBe("2026-W48"); // Friday night
    expect(weekOf(new Date("2026-11-27T20:30:00Z"))).toBe("2026-W49");
  });

  it("rolls the year with the ISO rule applied to the shifted week", () => {
    expect(weekOf(new Date("2026-12-26T12:00:00Z"))).toBe("2026-W53"); // Saturday
    expect(weekOf(new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53"); // Friday
    expect(weekOf(new Date("2027-01-02T12:00:00Z"))).toBe("2027-W01"); // Saturday
    expect(weekOf(new Date("2025-12-26T12:00:00Z"))).toBe("2025-W52"); // Friday
    expect(weekOf(new Date("2025-12-27T12:00:00Z"))).toBe("2026-W01"); // Saturday
    expect(weekOf(new Date("2026-01-02T12:00:00Z"))).toBe("2026-W01");
    expect(weekOf(new Date("2026-01-03T12:00:00Z"))).toBe("2026-W02");
  });

  it("gives the start and end of a week as instants", () => {
    expect(weekStart("2026-W48").toISOString()).toBe("2026-11-20T20:30:00.000Z");
    expect(weekEnd("2026-W48").toISOString()).toBe("2026-11-27T20:30:00.000Z");
    expect(weekStart("2027-W01").toISOString()).toBe("2027-01-01T20:30:00.000Z");
  });

  it("round-trips: every instant is inside its own week", () => {
    for (let t = Date.UTC(2025, 0, 1); t < Date.UTC(2028, 0, 1); t += 7 * 3_600_000 + 1234) {
      const at = new Date(t);
      const week = weekOf(at);
      expect(weekStart(week).getTime()).toBeLessThanOrEqual(t);
      expect(weekEnd(week).getTime()).toBeGreaterThan(t);
      expect(weekOf(weekStart(week))).toBe(week);
    }
  });

  it("finds the previous week", () => {
    expect(previousWeek("2026-W48")).toBe("2026-W47");
    expect(previousWeek("2027-W01")).toBe("2026-W53");
    expect(previousWeek("2026-W01")).toBe("2025-W52");
  });
});
