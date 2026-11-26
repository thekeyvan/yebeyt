import { afterEach, describe, expect, it, vi } from "vitest";
import { devPagesEnabled } from "../lib/dev";

afterEach(() => vi.unstubAllEnvs());

describe("devPagesEnabled", () => {
  it("is on while developing", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(devPagesEnabled()).toBe(true);
  });

  it("is off in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(devPagesEnabled()).toBe(false);
  });

  it("is on in a production build made with NEXT_PUBLIC_DEV_PAGES=1", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEV_PAGES", "1");
    expect(devPagesEnabled()).toBe(true);
  });
});
