import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/account/api";
import { UsernameAvailability } from "../lib/account/usernameAvailability";
import { MyStats } from "../lib/account/myStats";
import { AccountSignOut } from "../lib/account/signOut";
import { GameStats } from "../lib/games/stats";
import { ReaderMarks } from "../lib/reader/marks";
import { ReactionsSync } from "../lib/account/reactionsSync";
import { ScoreSync } from "../lib/account/scoreSync";
import { DivanSync } from "../lib/account/divanSync";
import { offline, sessionOf, userOf } from "./account";
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
    const api = { stats: vi.fn(async () => ({ totalPoints: remote?.totalPoints ?? 0, weekPoints: 0, streakDays: remote?.streakDays ?? 0, league: { tier: 1 } })) };
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
});

describe("AccountSignOut (Me/Settings/AccountLeaving.swift)", () => {
  const fixture = () => {
    const storage = memoryStorage();
    const session = sessionOf(true, "u1") as ReturnType<typeof sessionOf> & { signOut: () => Promise<void> };
    session.signOut = vi.fn(async () => {
      session.isSignedIn = false;
      session.user = undefined;
    });
    const server = {
      divan: vi.fn(async () => []),
      putDivan: vi.fn(async () => []),
      setReaction: vi.fn(async () => undefined),
      myReactions: vi.fn(async () => ({ items: [], nextCursor: null })),
      postScore: vi.fn(async () => undefined),
      postDaily: vi.fn(async () => undefined),
    };
    const marks = new ReaderMarks(storage, () => 2_000);
    const stats = new GameStats(storage, () => new Date("2026-11-23T10:00:00Z"));
    const divan = new DivanSync(marks, session, server, 60_000);
    const reactions = new ReactionsSync(marks, session, server, storage);
    const scores = new ScoreSync(session, server, storage);
    const leaving = new AccountSignOut(session, { marks, stats, reactions, scores, divan });
    return { storage, session, server, marks, stats, divan, reactions, scores, leaving };
  };

  it("syncs once more, then forgets the account's data here", async () => {
    const f = fixture();
    f.marks.toggle("kept", "/a/b/c", 0);
    f.marks.toggle("liked", "/a/b/c", 1);
    f.stats.award(100);
    f.stats.claim("u1");
    expect(await f.leaving.signOut()).toBe("done");
    expect(f.server.putDivan).toHaveBeenCalled();
    expect(f.server.setReaction).toHaveBeenCalled();
    expect(f.session.signOut).toHaveBeenCalledTimes(1);
    expect(f.marks.divanItems()).toEqual([]);
    expect(f.marks.keys("liked").size).toBe(0);
    expect(f.reactions.hasUnsent).toBe(false);
    expect(f.stats.owner).toBeUndefined();
    expect(f.stats.guestPoints).toBe(0);
  });

  it("waits, and loses nothing, when the last sync did not go through", async () => {
    const f = fixture();
    f.server.divan.mockRejectedValue(offline());
    f.marks.toggle("kept", "/a/b/c", 0);
    expect(await f.leaving.signOut()).toBe("unsynced");
    expect(f.session.isSignedIn).toBe(true);
    expect([...f.marks.keys("kept")]).toEqual(["/a/b/c#0"]);
    expect(f.session.signOut).not.toHaveBeenCalled();
  });

  it("signs out anyway when the person insists, without trying the sync again", async () => {
    const f = fixture();
    f.server.divan.mockRejectedValue(offline());
    f.marks.toggle("kept", "/a/b/c", 0);
    await f.leaving.signOut();
    f.server.divan.mockClear();
    expect(await f.leaving.signOut(true)).toBe("done");
    expect(f.server.divan).not.toHaveBeenCalled();
    expect(f.marks.divanItems()).toEqual([]);
    expect(f.session.isSignedIn).toBe(false);
  });

  it("is held back by unsent likes and unsent scores too", async () => {
    const likes = fixture();
    likes.server.setReaction.mockRejectedValue(offline());
    likes.marks.toggle("liked", "/a/b/c", 1);
    expect(await likes.leaving.signOut()).toBe("unsynced");
    expect(likes.reactions.hasUnsent && likes.marks.keys("liked").size === 1).toBe(true);
    expect(await likes.leaving.signOut(true)).toBe("done");

    const scores = fixture();
    scores.server.postScore.mockRejectedValue(new ApiError(503, "unavailable"));
    scores.scores.report("poet", 40);
    expect(await scores.leaving.signOut()).toBe("unsynced");
    expect(await scores.leaving.signOut(true)).toBe("done");
    expect(scores.scores.hasUnsent).toBe(false);
  });

  it("holds the points back for the next account: only what is earned afterwards is offered", async () => {
    const f = fixture();
    f.stats.award(100);
    f.stats.claim("u1");
    await f.leaving.signOut();
    f.stats.award(30);
    expect(f.stats.guestPoints).toBe(30);
    expect(f.stats.claim("second")).toBe(true);
    expect(userOf("x").id).toBe("x");
  });
});
