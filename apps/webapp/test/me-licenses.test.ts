import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creditGroups } from "../lib/me/licenses";

const notices = readFileSync(join(process.cwd(), "../../THIRD_PARTY_NOTICES.md"), "utf8");

describe("the licences screen (Me/Settings/LicensesScreen.swift)", () => {
  it("has the groups of the phone's screen, in order, then the web app's own libraries", () => {
    expect(creditGroups.map((group) => group.title)).toEqual(["قلم‌ها", "شعر، معنی‌ها و خوانش‌ها", "کتابخونه‌ها"]);
    expect(creditGroups[0]!.credits.map((credit) => credit.name)).toEqual([
      "Parastoo, Gandom, Sahel, Shabnam",
      "Vazirmatn",
      "Lalezar",
      "Markazi Text",
      "Noto Naskh Arabic, Noto Nastaliq Urdu",
    ]);
    expect(creditGroups[1]!.credits.map((credit) => credit.name)).toEqual(["Ganjoor (ganjoor.net)"]);
  });

  it("names only what THIRD_PARTY_NOTICES.md names, with the same licence", () => {
    for (const { name, license } of creditGroups.flatMap((group) => group.credits)) {
      const first = name.split(/[,(]/)[0]!.trim();
      expect(notices, name).toContain(first);
      if (license.startsWith("SIL")) expect(notices, name).toContain("OFL 1.1");
    }
  });
});
