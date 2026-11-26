import { describe, expect, it } from "vitest";
import { persianDigits, unreadText } from "../lib/persian";

describe("persianDigits", () => {
  it("writes counts with Persian digits", () => {
    expect(persianDigits(2480)).toBe("۲۴۸۰");
    expect(persianDigits(0)).toBe("۰");
  });

  it("groups thousands with the Persian separator", () => {
    expect(persianDigits(2480, { grouped: true })).toBe("۲٬۴۸۰");
    expect(persianDigits(999, { grouped: true })).toBe("۹۹۹");
    expect(persianDigits(1234567, { grouped: true })).toBe("۱٬۲۳۴٬۵۶۷");
  });
});

describe("unreadText", () => {
  it("is hidden at zero", () => {
    expect(unreadText(0)).toBeNull();
    expect(unreadText(3)).toBe("۳");
  });
});
