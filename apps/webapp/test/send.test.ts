import { describe, expect, it, vi } from "vitest";
import { copy, send } from "../lib/reader/send";

const abort = () => Object.assign(new Error("closed"), { name: "AbortError" });

describe("بفرست", () => {
  it("opens the browser's share sheet with the text, and copies nothing", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    const copied = vi.fn();
    await send("متن", { share, writeText }, copied);
    expect(share).toHaveBeenCalledWith({ text: "متن" });
    expect(writeText).not.toHaveBeenCalled();
    expect(copied).not.toHaveBeenCalled();
  });

  it("copies the text and says so where there is no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const copied = vi.fn();
    await send("متن", { writeText }, copied);
    expect(writeText).toHaveBeenCalledWith("متن");
    expect(copied).toHaveBeenCalledOnce();
  });

  it("does not copy after a share sheet that was closed", async () => {
    const writeText = vi.fn();
    await send("متن", { share: () => Promise.reject(abort()), writeText }, vi.fn());
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies when the share sheet fails", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const copied = vi.fn();
    await send("متن", { share: () => Promise.reject(new Error("no")), writeText }, copied);
    expect(copied).toHaveBeenCalledOnce();
  });
});

describe("کپی متن", () => {
  it("puts the text on the clipboard and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const copied = vi.fn();
    await copy("متن", { writeText }, copied);
    expect(writeText).toHaveBeenCalledWith("متن");
    expect(copied).toHaveBeenCalledOnce();
  });

  it("does not say it copied when the clipboard refuses", async () => {
    const copied = vi.fn();
    await copy("متن", { writeText: () => Promise.reject(new Error("denied")) }, copied);
    expect(copied).not.toHaveBeenCalled();
  });
});
