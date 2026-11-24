import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACCESSORIES, BACKGROUNDS, EYES, HAIRS, MOUTHS, SKINS } from "../lib/avatar";

const swift = readFileSync(new URL("../../ios/Yebeyt/Me/Avatar/AvatarParts.swift", import.meta.url), "utf8");

/** `("id", "title", 0xHEX)` rows of `static let <name>: [...] = [ ... ]` as {id: "#HEX"}. */
function colours(name: string) {
  const block = swift.match(new RegExp(`static let ${name}:[^=]*=\\s*\\[([\\s\\S]*?)\\n    \\]`))?.[1] ?? "";
  return Object.fromEntries([...block.matchAll(/\("(\w+)", "[^"]*", 0x([0-9A-Fa-f]{6})\)/g)].map((m) => [m[1], `#${m[2]!.toUpperCase()}`]));
}

const ids = (text: string | undefined) => [...(text ?? "").matchAll(/AvatarOption\(id: "(\w+)"/g)].map((m) => m[1]);

describe("the web's avatar parts", () => {
  it("are the app's AvatarParts.swift: same ids, same colours, same order", () => {
    for (const [name, table] of [["skins", SKINS], ["hairs", HAIRS], ["backgrounds", BACKGROUNDS]] as const) {
      expect(Object.keys(colours(name)).length, name).toBeGreaterThan(0);
      expect(Object.entries(table), name).toEqual(Object.entries(colours(name)));
    }
    expect(ids(swift.match(/static let eyes = \[(.*)\]/)?.[1])).toEqual([...EYES]);
    expect(ids(swift.match(/static let mouths = \[(.*)\]/)?.[1])).toEqual([...MOUTHS]);
    const accessories = swift.match(/enum Accessory: String[^{]*\{\s*case ([^\n]+)/)?.[1]?.split(",").map((id) => id.trim());
    expect(accessories).toEqual([...ACCESSORIES]);
  });
});
