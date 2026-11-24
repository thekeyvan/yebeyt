import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACCESSORIES, BACKGROUNDS, EYES, HAIRS, MOUTHS, SKINS } from "../lib/avatar";

const ID = "[a-z0-9-]+"; // the contract's ids: letters, digits and dashes

/** The list `static let <name>...= [ ... ]` of AvatarParts.swift, up to its closing bracket. */
function list(swift: string, name: string, multiline: boolean) {
  const body = multiline ? "\\s*\\[([\\s\\S]*?)\\n\\s*\\]" : "\\s*\\[(.*)\\]";
  return swift.match(new RegExp(`static let ${name}\\b[^=\\n]*=${body}`))?.[1] ?? "";
}

/** `("id", "title", 0xHEX)` rows of a colour list as [id, "#HEX"]; a row it can't read fails the count. */
function colours(swift: string, name: string) {
  const block = list(swift, name, true);
  const rows = [...block.matchAll(/\("/g)].length;
  const read = [...block.matchAll(new RegExp(`\\("(${ID})", "[^"]*", 0x([0-9A-Fa-f]{6})\\)`, "g"))];
  expect(read.length, `${name}: rows read`).toBe(rows);
  return read.map((m) => [m[1], `#${m[2]!.toUpperCase()}`]);
}

/** `AvatarOption(id: "x", ...)` items of a variant list; an item it can't read fails the count. */
function options(swift: string, name: string) {
  const block = list(swift, name, false);
  const items = [...block.matchAll(/AvatarOption\(/g)].length;
  const read = [...block.matchAll(new RegExp(`AvatarOption\\(id: "(${ID})"`, "g"))].map((m) => m[1]!);
  expect(read.length, `${name}: items read`).toBe(items);
  return read;
}

/** Every `case` line of `enum Accessory`, up to its nested `enum Unlock` (one id per line, or a comma list). */
function accessories(swift: string) {
  const start = swift.indexOf("enum Accessory:");
  const end = swift.indexOf("enum Unlock", start);
  expect(start, "enum Accessory").toBeGreaterThanOrEqual(0);
  expect(end, "enum Unlock after it").toBeGreaterThan(start);
  const lines = swift.slice(start, end).split("\n").map((line) => line.trim()).filter((line) => line.startsWith("case "));
  return lines.flatMap((line) => {
    const match = line.match(new RegExp(`^case (${ID}(?:, ${ID})*)$`));
    expect(match, `unreadable case line: ${line}`).not.toBeNull();
    return match![1]!.split(", ");
  });
}

const tablesOf = (swift: string) => ({
  skins: colours(swift, "skins"),
  hairs: colours(swift, "hairs"),
  backgrounds: colours(swift, "backgrounds"),
  eyes: options(swift, "eyes"),
  mouths: options(swift, "mouths"),
  accessories: accessories(swift),
});

const web = {
  skins: Object.entries(SKINS),
  hairs: Object.entries(HAIRS),
  backgrounds: Object.entries(BACKGROUNDS),
  eyes: [...EYES],
  mouths: [...MOUTHS],
  accessories: [...ACCESSORIES],
};

const swift = readFileSync(new URL("../../ios/Yebeyt/Me/Avatar/AvatarParts.swift", import.meta.url), "utf8");

describe("the web's avatar parts", () => {
  it("are the app's AvatarParts.swift: same ids, same colours, same order", () => {
    const app = tablesOf(swift);
    for (const name of Object.keys(web) as (keyof typeof web)[]) {
      expect(app[name].length, name).toBeGreaterThan(0);
      expect(web[name], name).toEqual(app[name]);
    }
  });

  it("are read from the Swift whatever the shape: dashed ids, several case lines", () => {
    const fixture = `
      enum Accessory: String, CaseIterable, Sendable {
          case none, ney
          case rose
          case wizard-hat, candle

          enum Unlock: Equatable, Sendable {
              case bookWins(Int)
          }
      }
      enum AvatarCatalogue {
          static let skins: [(id: String, title: String, hex: UInt32)] = [
              ("peach", "x", 0xf2c29b), ("deep-tan", "y", 0xC98F63),
          ]
          static let eyes = [AvatarOption(id: "round", title: "x"), AvatarOption(id: "half-shut", title: "y")]
      }`;
    expect(accessories(fixture)).toEqual(["none", "ney", "rose", "wizard-hat", "candle"]);
    expect(colours(fixture, "skins")).toEqual([["peach", "#F2C29B"], ["deep-tan", "#C98F63"]]);
    expect(options(fixture, "eyes")).toEqual(["round", "half-shut"]);
  });

  it("fail loudly on a row or case line the reader can't understand", () => {
    expect(() => colours('static let skins: [(id: String)] = [\n ("Peach!", "x", 0xF2C29B),\n    ]', "skins")).toThrow(/rows read/);
    expect(() => options('static let eyes = [AvatarOption(id: "round", title: "x"), AvatarOption(id: kind, title: "y")]', "eyes")).toThrow(/items read/);
    expect(() => accessories('enum Accessory: String {\n case none = "none"\n enum Unlock {}')).toThrow(/unreadable case line/);
  });
});
