import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import tokens from "../../../packages/tokens/tokens.json";

const theme = readFileSync(resolve(process.cwd(), "app/theme.css"), "utf8");

describe("theme.css (generated from tokens.json)", () => {
  it("has every colour", () => {
    for (const hex of Object.values(tokens.colors)) expect(theme).toContain(hex);
  });

  it("has a font face for every font file", () => {
    for (const { file } of [...Object.values(tokens.fonts), ...Object.values(tokens.readerFonts)]) expect(theme).toContain(`/fonts/${file}`);
  });

  it("has the sticker radii, border widths and shadows", () => {
    expect(theme).toContain("--radius-tab-bar: 26px;");
    expect(theme).toContain("@utility border-card {\n  border-width: 5px;");
    expect(theme).toContain("--shadow-tab-bar: 0 4px 16px rgba(20,17,43,0.16);");
  });
});
