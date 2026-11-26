import { describe, expect, it, vi } from "vitest";
import { appleNonce, AppleCredentials, appleStateKey, googleName, SignInCanceled, sha256Hex, type AppleAnswer } from "../lib/account/credentials";

describe("the nonce of Sign in with Apple (Account/Credentials.swift `AppleNonce`)", () => {
  it("is random and long enough", () => {
    const nonces = Array.from({ length: 20 }, () => appleNonce());
    expect(new Set(nonces).size).toBe(20);
    expect(nonces.every((nonce) => nonce.length === 32)).toBe(true);
    expect(appleNonce(64)).toHaveLength(64);
    expect(nonces.every((nonce) => /^[0-9A-Za-z.-]+$/.test(nonce))).toBe(true);
  });

  it("gives Apple the hash and the server the raw value", async () => {
    // SHA-256 of «abc» is a well-known value, lower-case hex like the server's.
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    const raw = appleNonce();
    expect(await sha256Hex(raw)).not.toBe(raw);
    expect(await sha256Hex(raw)).toHaveLength(64);
  });
});

describe("Sign in with Apple JS", () => {
  const redirect = "https://app.yebeyt.com/auth/apple";
  // Apple's answer carries back the `state` it was set up with, unless the test says otherwise.
  const fake = (answer: () => Promise<AppleAnswer>, echoState = true) => {
    const auth = {
      init: vi.fn(),
      signIn: vi.fn(async () => {
        const given = await answer();
        const { state } = auth.init.mock.calls.at(-1)![0] as { state: string };
        return given.authorization && echoState ? { ...given, authorization: { state, ...given.authorization } } : given;
      }),
    };
    return { auth, load: vi.fn(async () => auth) };
  };

  it("hands Apple the hashed nonce and returns the raw one with the identity token and the code", async () => {
    const { auth, load } = fake(async () => ({ authorization: { id_token: "idt", code: "code-1" }, user: { name: { firstName: "نیلوفر", lastName: "ش" } } }));
    const apple = new AppleCredentials("com.yebeyt.web", redirect, load);
    await apple.prepare();
    const result = await apple.signIn();
    const init = auth.init.mock.calls[0]![0] as { clientId: string; redirectURI: string; usePopup: boolean; nonce: string; scope: string };
    expect(init).toMatchObject({ clientId: "com.yebeyt.web", redirectURI: redirect, usePopup: true, scope: "name" });
    expect(result.credential).toMatchObject({ provider: "apple", identityToken: "idt", authorizationCode: "code-1", redirectUri: redirect });
    expect(result.name).toBe("نیلوفر ش");
    const raw = (result.credential as { nonce: string }).nonce;
    expect(await sha256Hex(raw)).toBe(init.nonce);
    expect(raw).not.toBe(init.nonce);
  });

  it("uses a new nonce for every sign-in", async () => {
    const { auth, load } = fake(async () => ({ authorization: { id_token: "idt", code: "c" } }));
    const apple = new AppleCredentials("com.yebeyt.web", redirect, load);
    await apple.prepare();
    const first = await apple.signIn();
    await vi.waitFor(() => expect(auth.init).toHaveBeenCalledTimes(2));
    const second = await apple.signIn();
    expect((first.credential as { nonce: string }).nonce).not.toBe((second.credential as { nonce: string }).nonce);
  });

  it("calls Apple at once from the press, as a popup must", async () => {
    const { auth, load } = fake(async () => ({ authorization: { id_token: "idt", code: "c" } }));
    const apple = new AppleCredentials("com.yebeyt.web", redirect, load);
    await apple.prepare();
    const pending = apple.signIn();
    expect(auth.signIn).toHaveBeenCalledTimes(1); // before anything has been awaited
    await pending;
  });

  it("is a cancel when the person closes the popup, and a failure otherwise", async () => {
    for (const error of ["popup_closed_by_user", "user_cancelled_authorize"]) {
      const apple = new AppleCredentials("x", redirect, fake(async () => Promise.reject({ error })).load);
      await apple.prepare();
      await expect(apple.signIn()).rejects.toBeInstanceOf(SignInCanceled);
    }
    const apple = new AppleCredentials("x", redirect, fake(async () => Promise.reject({ error: "invalid_client" })).load);
    await apple.prepare();
    await expect(apple.signIn()).rejects.not.toBeInstanceOf(SignInCanceled);
    const empty = new AppleCredentials("x", redirect, fake(async () => ({ authorization: {} })).load);
    await empty.prepare();
    await expect(empty.signIn()).rejects.toThrow();
  });

  it("sets Apple up with a random state, kept in sessionStorage, and a new one for the next sign-in", async () => {
    const { auth, load } = fake(async () => ({ authorization: { id_token: "idt", code: "c" } }));
    const apple = new AppleCredentials("x", redirect, load);
    await apple.prepare();
    const first = (auth.init.mock.calls[0]![0] as { state: string }).state;
    expect(first).toMatch(/^[0-9A-Za-z.-]{32}$/);
    expect(sessionStorage.getItem(appleStateKey)).toBe(first);
    await apple.signIn();
    await vi.waitFor(() => expect(auth.init).toHaveBeenCalledTimes(2));
    expect((auth.init.mock.calls[1]![0] as { state: string }).state).not.toBe(first);
  });

  it("refuses an answer whose state is not the one that was sent, or has none", async () => {
    for (const state of ["someone-elses", undefined]) {
      const { load } = fake(async () => ({ authorization: { id_token: "idt", code: "c", state: state as string } }), false);
      const apple = new AppleCredentials("x", redirect, load);
      await apple.prepare();
      await expect(apple.signIn()).rejects.toThrow("not to this sign-in");
    }
  });

  it("fails when it is pressed before the script has loaded", async () => {
    const apple = new AppleCredentials("x", redirect, fake(async () => ({})).load);
    await expect(apple.signIn()).rejects.toThrow();
  });
});

describe("the name Google shares", () => {
  const token = (payload: unknown) => `h.${btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.s`;

  it("is read from the id token's payload", () => {
    expect(googleName(token({ name: "Niloofar Sh" }))).toBe("Niloofar Sh");
    expect(googleName(token({ sub: "1" }))).toBeUndefined();
    expect(googleName("not a token")).toBeUndefined();
  });
});
