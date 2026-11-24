import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "../lib/clipboard";

afterEach(() => vi.unstubAllGlobals());

describe("copyText", () => {
  it("writes to the clipboard and says it worked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await copyText("https://yebeyt.com/c/7KQ2")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://yebeyt.com/c/7KQ2");
  });

  it("says false, and does not throw, when the browser refuses or has no clipboard", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    expect(await copyText("x")).toBe(false);
    vi.stubGlobal("navigator", {});
    expect(await copyText("x")).toBe(false);
  });

  it("does not wait for ever on a clipboard that never answers", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: () => new Promise(() => {}) } });
    expect(await copyText("x", 20)).toBe(false);
  });
});
