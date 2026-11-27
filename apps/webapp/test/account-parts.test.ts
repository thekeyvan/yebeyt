import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Api } from "../lib/account/api";
import { UsernameAvailability } from "../lib/account/usernameAvailability";
import { MyStats } from "../lib/account/myStats";
import { GameStats } from "../lib/games/stats";
import { offline, sessionOf } from "./account";
import { memoryStorage } from "./storage";

describe("UsernameAvailability (Account/UsernameAvailability.swift)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const field = (answer: (name: string) => { available: boolean; reason?: string } = () => ({ available: true }), own?: string) => {
    const asked: string[] = [];
    const model = new UsernameAvailability(async (name) => {
      asked.push(name);
      return answer(name) as never;
    }, own, 60);
    return { model, asked };
  };

  it("asks once after the last keystroke", async () => {
    const { model, asked } = field();
    for (const text of ["n", "ni", "nil", "nilo", "niloofar"]) model.setText(text);
    expect(model.state).toEqual({ kind: "checking" });
    await vi.advanceTimersByTimeAsync(100);
    expect(asked).toEqual(["niloofar"]);
    expect(model.state).toEqual({ kind: "available" });
  });

  it("answers by the local rules at once, without asking the server", async () => {
    const { model, asked } = field();
    model.setText("ab");
    expect(model.state).toEqual({ kind: "unavailable", problem: "too_short" });
    model.setText("ab cd");
    expect(model.state).toEqual({ kind: "unavailable", problem: "bad_chars" });
    model.setText("admin");
    expect(model.state).toEqual({ kind: "unavailable", problem: "reserved" });
    model.setText("a".repeat(21));
    expect(model.state).toEqual({ kind: "unavailable", problem: "too_long" });
    model.setText("");
    expect(model.state).toEqual({ kind: "idle" });
    await vi.advanceTimersByTimeAsync(100);
    expect(asked).toEqual([]);
  });

  it("shows the server's reason", async () => {
    const { model } = field(() => ({ available: false, reason: "taken" }));
    model.setText("hafez");
    expect(model.state).toEqual({ kind: "checking" });
    await vi.advanceTimersByTimeAsync(100);
    expect(model.state).toEqual({ kind: "unavailable", problem: "taken" });
    expect(model.isAvailable).toBe(false);
  });

  it("ignores a late answer for an old name", async () => {
    let release: (value: { available: boolean }) => void = () => {};
    const model = new UsernameAvailability((name) => (name === "first" ? new Promise((resolve) => (release = resolve)) : Promise.resolve({ available: true })), undefined, 60);
    model.setText("first");
    await vi.advanceTimersByTimeAsync(70); // the question for «first» is on its way
    model.setText("second");
    await vi.advanceTimersByTimeAsync(100);
    release({ available: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(model.state).toEqual({ kind: "available" });
    expect(model.normalized).toBe("second");
  });

  it("shows a Persian line, not a code, when the question could not be asked", async () => {
    const model = new UsernameAvailability(async () => Promise.reject(offline()), undefined, 60);
    model.setText("niloofar");
    await vi.advanceTimersByTimeAsync(100);
    expect(model.state).toEqual({ kind: "failed", message: offline().persianMessage });
  });

  it("holds the current username free for its owner", async () => {
    const { model, asked } = field(undefined, "niloofar");
    model.setText("Niloofar");
    expect(model.state).toEqual({ kind: "available" });
    await vi.advanceTimersByTimeAsync(100);
    expect(asked).toEqual([]);
  });
});

describe("MyStats (Games/MyStats.swift)", () => {
  const clock = () => new Date("2026-11-23T10:00:00Z");
  const fixture = (signedIn: boolean, remote?: { totalPoints: number; streakDays: number }, id = "u1") => {
    const stats = new GameStats(memoryStorage(), clock);
    const session = sessionOf(signedIn, id);
    const api = { stats: vi.fn(async () => ({ totalPoints: remote?.totalPoints ?? 0, weekPoints: 0, streakDays: remote?.streakDays ?? 0, league: { tier: 1 } })), profile: vi.fn(async () => ({ friendsCount: 12 }) as Awaited<ReturnType<Api["profile"]>>) };
    return { stats, session, api, mine: new MyStats(stats, session, api) };
  };

  it("shows a guest's own points and streak", () => {
    const f = fixture(false);
    f.stats.award(70);
    expect(f.mine.points).toBe(70);
    expect(f.mine.streak).toBe(0);
  });

  it("shows the server's once it has answered, but never less than this browser's own", async () => {
    const f = fixture(true, { totalPoints: 500, streakDays: 4 });
    f.stats.award(70);
    expect(f.mine.points).toBe(70);
    await f.mine.refresh();
    expect(f.mine.points).toBe(500);
    expect(f.mine.streak).toBe(4);
    f.stats.award(600); // rounds not sent yet
    expect(f.mine.points).toBe(670);
  });

  it("does not count points carried over to another account", async () => {
    const f = fixture(true, { totalPoints: 10, streakDays: 0 }, "me");
    f.stats.award(70);
    f.stats.claim("someone-else");
    await f.mine.refresh();
    expect(f.mine.points).toBe(10);
  });

  it("keeps what is shown when the server cannot be asked, and forgets it for a guest", async () => {
    const f = fixture(true, { totalPoints: 500, streakDays: 4 });
    await f.mine.refresh();
    f.api.stats.mockRejectedValue(offline());
    await f.mine.refresh();
    expect(f.mine.points).toBe(500);
    f.session.isSignedIn = false;
    await f.mine.refresh();
    expect(f.mine.points).toBe(0);
  });

  it("counts my friends from my own public profile (the profile's «۱۲ دوست»), and has no count for a guest", async () => {
    const f = fixture(true);
    expect(f.mine.friendsCount).toBeUndefined();
    await f.mine.refreshFriendsCount();
    expect(f.api.profile).toHaveBeenCalledWith("niloofar");
    expect(f.mine.friendsCount).toBe(12);
    f.api.profile.mockRejectedValue(offline());
    await f.mine.refreshFriendsCount();
    expect(f.mine.friendsCount).toBe(12); // a failure keeps what is shown
    f.session.isSignedIn = false;
    await f.mine.refreshFriendsCount();
    expect(f.mine.friendsCount).toBeUndefined();
  });

  it("keeps both results when the points and the friend count are asked at once, whichever answers first", async () => {
    for (const statsFirst of [true, false]) {
      const f = fixture(true);
      let answerStats = () => {};
      let answerProfile = () => {};
      f.api.stats.mockImplementation(() => new Promise((resolve) => (answerStats = () => resolve({ totalPoints: 500, weekPoints: 0, streakDays: 4, league: { tier: 1 } }))));
      f.api.profile.mockImplementation(() => new Promise((resolve) => (answerProfile = () => resolve({ friendsCount: 12 } as never))));
      const both = Promise.all([f.mine.refresh(), f.mine.refreshFriendsCount()]);
      (statsFirst ? [answerStats, answerProfile] : [answerProfile, answerStats]).forEach((answer) => answer());
      await both;
      expect([f.mine.points, f.mine.streak, f.mine.friendsCount], statsFirst ? "stats first" : "profile first").toEqual([500, 4, 12]);
    }
  });

  it("drops a friend count that comes after the person signed out, and forgets it on request", async () => {
    const f = fixture(true);
    let answer = () => {};
    f.api.profile.mockImplementation(() => new Promise((resolve) => (answer = () => resolve({ friendsCount: 12 } as never))));
    const asked = f.mine.refreshFriendsCount();
    f.session.user = undefined;
    answer();
    await asked;
    expect(f.mine.friendsCount).toBeUndefined();
    f.session.user = sessionOf(true).user;
    f.api.profile.mockResolvedValue({ friendsCount: 3 } as never);
    await f.mine.refreshFriendsCount();
    f.mine.clearFriendsCount();
    expect(f.mine.friendsCount).toBeUndefined();
  });
});
