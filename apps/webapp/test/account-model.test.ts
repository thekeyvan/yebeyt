import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/account/api";
import { AccountModel, type ProviderSignIn } from "../lib/account/accountModel";
import { SignInCanceled } from "../lib/account/credentials";
import { Session } from "../lib/account/session";
import { GameStats } from "../lib/games/stats";
import { newRecord } from "../lib/games/letterMarks";
import { TehranDay } from "../lib/games/tehranDay";
import { offline, settle, userOf } from "./account";
import { memoryStorage } from "./storage";

const apple: ProviderSignIn = { credential: { provider: "apple", identityToken: "idt", authorizationCode: "code", nonce: "raw", redirectUri: "https://app.yebeyt.com/auth/apple" }, name: "نیلوفر" };
const google: ProviderSignIn = { credential: { provider: "google", idToken: "gid" } };

type Fixture = ReturnType<typeof fixture>;

/** The account with a server that signs in as `username` (null: a new account). */
function fixture(options: { username?: string | null; signedIn?: boolean; noUser?: boolean; stats?: GameStats; apple?: () => Promise<ProviderSignIn> } = {}) {
  const username = options.username === undefined ? "ali" : options.username;
  const user = { ...userOf("00000000-0000-0000-0000-000000000009", username), displayName: null };
  const sent: { path: string; body: unknown }[] = [];
  const send = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    sent.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (path === "/auth/session") return Response.json(options.signedIn ? { signedIn: true, ...(options.noUser ? {} : { user }) } : { signedIn: false });
    return Response.json({ user });
  }) as unknown as typeof fetch;
  const session = new Session(send);
  const api = {
    putProgress: vi.fn(async () => undefined),
    setDisplayName: vi.fn(async (displayName: string) => ({ ...user, displayName })),
    setUsername: vi.fn(async (name: string) => ({ ...user, username: name })),
  };
  const stats = options.stats ?? new GameStats(memoryStorage(), () => new Date("2026-11-23T10:00:00Z"));
  const account = new AccountModel(session, stats, { apple: options.apple ?? (async () => apple) }, api);
  return { account, session, api, stats, sent };
}

const signedInFixture = async (options: Parameters<typeof fixture>[0] = {}): Promise<Fixture> => {
  const f = fixture({ ...options, signedIn: true });
  await f.session.restore();
  return f;
};

describe("the gate (Account/AccountModel.swift)", () => {
  it("stops a guest with the gate, and the action waits", async () => {
    const f = fixture();
    await f.session.restore();
    const action = vi.fn();
    f.account.require("likes", action);
    await settle();
    expect(action).not.toHaveBeenCalled();
    expect(f.account.snapshot().prompt).toEqual({ kind: "gate", feature: "likes" });
  });

  it("lets a signed-in person with a username go straight through", async () => {
    const f = await signedInFixture();
    const action = vi.fn();
    f.account.require("likes", action);
    expect(action).toHaveBeenCalledTimes(1);
    expect(f.account.snapshot().prompt).toBeUndefined();
  });

  it("drops the action and closes the gate on «بعداً»", async () => {
    const f = fixture();
    await f.session.restore();
    const action = vi.fn();
    f.account.require("messages", action);
    await settle();
    f.account.dismissPrompt();
    expect(f.account.snapshot().prompt).toBeUndefined();
    f.account.finishPrompt();
    expect(action).not.toHaveBeenCalled();
  });

  it("needs no account to take back a like", () => {
    const f = fixture();
    const action = vi.fn();
    f.account.require("likes", action, { needed: false });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("goes ahead with the action after signing in from the gate when there is a username", async () => {
    const f = fixture({ username: "ali" });
    await f.session.restore();
    const action = vi.fn();
    f.account.require("likes", action);
    await settle();
    const outcome = await f.account.signIn();
    expect(outcome).toEqual({ kind: "signedIn", needsUsername: false });
    expect(f.account.afterGate(outcome)).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
    expect(f.account.snapshot().prompt).toBeUndefined();
  });

  it("goes through the username before the action runs when the account is new", async () => {
    const f = fixture({ username: null });
    await f.session.restore();
    const action = vi.fn();
    f.account.require("likes", action);
    await settle();
    expect(f.account.afterGate(await f.account.signIn())).toBeNull();
    expect(action).not.toHaveBeenCalled();
    expect(f.account.snapshot().prompt).toEqual({ kind: "username" });
    expect(await f.account.saveProfile("", "niloofar")).toBeNull();
    f.account.finishPrompt();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("asks a signed-in person without a username for it when they use something with an account", async () => {
    const f = fixture({ username: null, signedIn: true });
    await f.session.restore();
    const action = vi.fn();
    f.account.require("likes", action);
    expect(action).not.toHaveBeenCalled();
    expect(f.account.snapshot().prompt).toEqual({ kind: "username" });
  });

  it("looks the user up first when the page has not finished asking who is signed in, and ignores taps meanwhile", async () => {
    const f = fixture({ signedIn: true, username: "ali" });
    const action = vi.fn();
    f.account.require("likes", action); // the session is still «loading»
    f.account.require("likes", action);
    expect(action).not.toHaveBeenCalled();
    await settle();
    expect(action).toHaveBeenCalledTimes(1); // only the first waiting action is kept
    expect(f.account.snapshot().prompt).toBeUndefined();
  });

  it("lets the action go when the user could not be looked up (no network): the server decides later", async () => {
    const f = fixture({ signedIn: true, noUser: true });
    const action = vi.fn();
    f.account.require("likes", action);
    await settle();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("has the lead's titles", async () => {
    const { accountFeatures } = await import("../lib/account/features");
    expect(Object.values(accountFeatures)).toEqual(["پسند و بازنشر", "پیام دادن به دوستات", "دعوت دوستات", "همگام کردن دیوان و امتیازهات", "دیدن رده‌بندی", "مشاعره با دوستات"]);
  });
});

describe("signing in", () => {
  it("sends Apple's identity token, the code, the raw nonce and the return URL; Google's id token", async () => {
    const f = fixture();
    await f.session.restore();
    await f.account.signInWith(apple);
    expect(f.sent.find((call) => call.path === "/auth/apple")?.body).toEqual({ identityToken: "idt", authorizationCode: "code", nonce: "raw", redirectUri: "https://app.yebeyt.com/auth/apple" });
    await f.account.signInWith(google);
    expect(f.sent.find((call) => call.path === "/auth/google")?.body).toEqual({ idToken: "gid" });
  });

  it("answers a cancel with nothing changed, and a failure with a Persian line", async () => {
    const canceled = fixture({ apple: async () => Promise.reject(new SignInCanceled()) });
    expect(await canceled.account.signIn()).toEqual({ kind: "canceled" });
    expect(canceled.session.isSignedIn).toBe(false);
    const failed = fixture({ apple: async () => Promise.reject(new Error("boom")) });
    expect(await failed.account.signIn()).toEqual({ kind: "failed", message: new ApiError(500).persianMessage });
    const refused = fixture();
    (refused.session as { signIn: unknown }).signIn = async () => Promise.reject(new ApiError(401, "invalid_token"));
    expect(await refused.account.signInWith(google)).toEqual({ kind: "failed", message: "ورود انجام نشد؛ دوباره امتحان کن." });
    const offlineNow = fixture();
    (offlineNow.session as { signIn: unknown }).signIn = async () => Promise.reject(offline());
    expect(await offlineNow.account.signInWith(google)).toEqual({ kind: "failed", message: "اینترنت نیست؛ یه بار دیگه امتحان کن." });
  });

  it("keeps the provider's name only to fill the name field, and the provider for the chip", async () => {
    const f = fixture({ username: null });
    await f.account.signInWith(apple);
    expect(f.account.snapshot()).toMatchObject({ provider: "apple", providerName: "نیلوفر" });
    await f.account.saveProfile("", "niloofar");
    expect(f.account.snapshot().providerName).toBeUndefined();
  });

  it("answers a second sign-in while one is running with a cancel", async () => {
    let release: (value: ProviderSignIn) => void = () => {};
    const f = fixture({ apple: () => new Promise((resolve) => (release = resolve)) });
    const first = f.account.signIn();
    expect(await f.account.signIn()).toEqual({ kind: "canceled" });
    release(apple);
    expect((await first).kind).toBe("signedIn");
  });
});

describe("the name and the username", () => {
  it("saves the trimmed name, then the username", async () => {
    const f = await signedInFixture({ username: null });
    expect(await f.account.saveProfile("  نیلوفر ", "niloofar")).toBeNull();
    expect(f.api.setDisplayName).toHaveBeenCalledWith("نیلوفر");
    expect(f.api.setUsername).toHaveBeenCalledWith("niloofar");
    expect(f.session.user?.username).toBe("niloofar");
  });

  it("does not save an empty name, or the one that is already saved", async () => {
    const f = await signedInFixture({ username: null });
    await f.account.saveProfile("   ", "niloofar");
    expect(f.api.setDisplayName).not.toHaveBeenCalled();
  });

  it("refuses a name that is too long on the spot, and saves nothing", async () => {
    const f = await signedInFixture({ username: null });
    expect(await f.account.saveProfile("a".repeat(31), "niloofar")).toBe("حداکثر ۳۰ حرف");
    expect(f.api.setUsername).not.toHaveBeenCalled();
  });

  it("brings a taken username back as Persian copy, and a failed name leaves the username untouched", async () => {
    const f = await signedInFixture({ username: null });
    f.api.setUsername.mockRejectedValue(new ApiError(409, "username_taken"));
    expect(await f.account.saveProfile("", "sara")).toBe("قبلاً گرفته شده");
    const g = await signedInFixture({ username: null });
    g.api.setDisplayName.mockRejectedValue(offline());
    expect(await g.account.saveProfile("نیلوفر", "niloofar")).toBe("اینترنت نیست؛ یه بار دیگه امتحان کن.");
    expect(g.api.setUsername).not.toHaveBeenCalled();
  });
});

describe("guest progress goes to the account (Account/ProgressCarryOver.swift)", () => {
  const clock = () => new Date("2026-11-23T10:00:00Z");
  const played = () => {
    const stats = new GameStats(memoryStorage(), clock);
    stats.record({ ...newRecord(), tries: ["مصام"], outcome: "solved", points: 100 }, stats.today);
    stats.award(40);
    stats.raiseBest("jigsaw", 215);
    return stats;
  };

  it("sends the points, the streak and the best of every game right after the sign-in", async () => {
    const f = fixture({ stats: played() });
    await f.account.signInWith(google);
    expect(f.api.putProgress).toHaveBeenCalledWith({ points: 140, streakDays: 1, streakLastDate: "2026-11-23", bestByGame: { daily: 100, jigsaw: 215 } });
  });

  it("lets the first account to sign in own the points here, and gives another none", async () => {
    const stats = new GameStats(memoryStorage(), clock);
    stats.award(70);
    const first = fixture({ stats });
    await first.account.signInWith(google);
    expect(stats.owner).toBe("00000000-0000-0000-0000-000000000009");
    expect(first.api.putProgress).toHaveBeenCalledTimes(1);
    expect(stats.claim("someone-else")).toBe(false); // not the owner: nothing changes
    expect(stats.owner).toBe("00000000-0000-0000-0000-000000000009");

    const other = new GameStats(memoryStorage(), clock);
    other.award(70);
    expect(other.claim("a")).toBe(true);
    expect(other.claim("b")).toBe(false);
    const second = fixture({ stats: other });
    await second.account.signInWith(google); // the server signs in as …09, not "a"
    expect(second.api.putProgress).not.toHaveBeenCalled();
  });

  it("sends nothing for a guest with nothing", async () => {
    const f = fixture();
    await f.account.signInWith(google);
    expect(f.api.putProgress).not.toHaveBeenCalled();
  });

  it("does not show a failure: the points stay here", async () => {
    const f = fixture({ stats: played() });
    f.api.putProgress.mockRejectedValue(offline());
    expect((await f.account.signInWith(google)).kind).toBe("signedIn");
  });

  it("makes the streak's last day yesterday when today's puzzle is not solved yet", () => {
    const stats = new GameStats(memoryStorage(), clock);
    stats.record({ ...newRecord(), tries: ["م"], outcome: "solved", points: 100 }, stats.today.previous);
    expect(stats.carryOver).toMatchObject({ streakDays: 1, streakLastDate: "2026-11-22" });
    expect(new GameStats(memoryStorage(), clock).carryOver.streakLastDate).toBeNull();
  });

  it("holds back what an account that left took with it (release)", () => {
    const stats = new GameStats(memoryStorage(), clock);
    stats.award(100);
    stats.raiseBest("jigsaw", 90);
    stats.record({ ...newRecord(), tries: ["مصام"], outcome: "solved", points: 100 }, stats.today);
    stats.claim("first");
    expect(stats.guestPoints).toBe(200);
    stats.release();
    expect(stats.owner).toBeUndefined();
    expect(stats.guestPoints).toBe(0);
    expect(stats.streak).toBe(0);
    expect(stats.best("jigsaw")).toBe(0);
    expect(stats.carryOver).toEqual({ points: 0, streakDays: 0, streakLastDate: null, bestByGame: {} });
    stats.award(30); // earned as a guest afterwards
    expect(stats.guestPoints).toBe(30);
    expect(stats.claim("second")).toBe(true);
    expect(stats.claim("first")).toBe(false);
    expect(stats.points).toBe(230);
    expect(TehranDay.of(clock()).number).toBe(stats.today.number);
  });

  it("keeps the owner and the held-back points across a reload", () => {
    const storage = memoryStorage();
    const stats = new GameStats(storage, clock);
    stats.award(100);
    stats.claim("first");
    stats.release();
    stats.award(30);
    stats.claim("second");
    const reopened = new GameStats(storage, clock);
    expect(reopened.owner).toBe("second");
    expect(reopened.guestPoints).toBe(30);
  });
});
