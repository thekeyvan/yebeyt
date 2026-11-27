import { describe, expect, it, vi } from "vitest";
import type { User } from "../lib/account/api";
import { emailLine, newsCopy, setNews, type NewsSession } from "../lib/me/newsChoice";
import { offline, refused, userOf } from "./account";

// Ported from apps/ios/YebeytTests/NewsChoiceTests.swift.

const sessionWith = (user: User): NewsSession & { user: User } => {
  const session = {
    user,
    update(next: User) {
      session.user = next;
    },
  };
  return session;
};

const mine = (): User => ({ ...userOf(), email: "niloofar@example.com", newsOptIn: false });

describe("the email row", () => {
  it("shows the address, «مخفی (اپل)» for Apple's relay address, and nothing without one", () => {
    expect(emailLine("niloofar@example.com")).toBe("niloofar@example.com");
    expect(emailLine("x7k2@privaterelay.appleid.com")).toBe(newsCopy.hiddenEmail);
    expect(emailLine("X7K2@PrivateRelay.AppleID.com")).toBe("مخفی (اپل)");
    expect(emailLine("a@notprivaterelay.appleid.com.example.com")).toBe("a@notprivaterelay.appleid.com.example.com");
    expect(emailLine(null)).toBeUndefined();
    expect(emailLine(undefined)).toBeUndefined();
    expect(emailLine("")).toBeUndefined();
  });

  it("says the same Persian as the phone", () => {
    expect(newsCopy).toEqual({ emailTitle: "ایمیل", hiddenEmail: "مخفی (اپل)", switchTitle: "خبرهای یه بیت رو برام ایمیل کن", switchNote: "هر وقت بخوای خاموشش کن" });
  });
});

describe("the news switch", () => {
  it("flips at once, before the server answers, and keeps the server's answer", async () => {
    const session = sessionWith(mine());
    let answer!: (user: User) => void;
    const api = { setNews: vi.fn((): Promise<User> => new Promise((resolve) => (answer = resolve))) };
    const done = setNews(true, session, api);
    expect(session.user.newsOptIn).toBe(true); // before the answer is in
    expect(api.setNews).toHaveBeenCalledWith(true);
    answer({ ...mine(), newsOptIn: true });
    expect(await done).toBeUndefined();
    expect(session.user.newsOptIn).toBe(true);
  });

  it("flips back when the server refuses, and says why in the usual line", async () => {
    const session = sessionWith(mine());
    const line = await setNews(true, session, { setNews: async () => Promise.reject(refused(500, "internal_error")) });
    expect(line).toBe("یه مشکلی پیش اومد؛ یه بار دیگه امتحان کن.");
    expect(session.user.newsOptIn).toBe(false);
    expect(session.user.email).toBe("niloofar@example.com");
  });

  it("flips back to what it was when the browser is offline", async () => {
    const session = sessionWith({ ...mine(), newsOptIn: true });
    const line = await setNews(false, session, { setNews: async () => Promise.reject(offline()) });
    expect(line).toBe("اینترنت نیست؛ یه بار دیگه امتحان کن.");
    expect(session.user.newsOptIn).toBe(true);
  });

  it("does nothing without a user", async () => {
    const update = vi.fn();
    const api = { setNews: vi.fn() };
    expect(await setNews(true, { user: undefined, update }, api)).toBeDefined();
    expect(update).not.toHaveBeenCalled();
    expect(api.setNews).not.toHaveBeenCalled();
  });
});
