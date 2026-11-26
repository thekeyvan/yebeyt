import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/account/api";
import { ScoreSync } from "../lib/account/scoreSync";
import { GameStats } from "../lib/games/stats";
import { scoreCaps, scoreGameOf, clipped } from "../lib/games/scoreGame";
import { TehranDay } from "../lib/games/tehranDay";
import { newRecord } from "../lib/games/letterMarks";
import { offline, refused, sessionOf } from "./account";
import { memoryStorage } from "./storage";

const now = () => Date.parse("2027-01-15T08:00:00.000Z");

const fixture = (signedIn = true, storage = memoryStorage()) => {
  const api = { postScore: vi.fn(async () => undefined), postDaily: vi.fn(async () => undefined) };
  const session = sessionOf(signedIn);
  return { api, session, storage, sync: new ScoreSync(session, api, storage, now) };
};

describe("the score caps (Games/ScoreGame.swift)", () => {
  it("are the server's", () => {
    expect(Object.entries(scoreCaps).map(([game, cap]) => `${game}=${cap}`)).toEqual(["daily=100", "jigsaw=320", "poet=440", "second=440", "book=440", "match=50", "listen=100", "onboarding=50"]);
    expect(scoreGameOf("misra")).toBe("second");
    expect(scoreGameOf("poet")).toBe("poet");
    expect(scoreGameOf("mosh")).toBeUndefined();
    expect(scoreGameOf("duel")).toBeUndefined();
    expect(clipped("match", 75)).toBe(50);
    expect(clipped("match", -3)).toBe(0);
  });
});

describe("ScoreSync (Games/ScoreSync.swift)", () => {
  it("sends a finished round with its own round id", async () => {
    const f = fixture();
    f.sync.report("poet", 260);
    await f.sync.flush();
    const [request] = f.api.postScore.mock.calls[0] as unknown as [{ roundId: string; game: string; points: number; playedAt: string }];
    expect(request).toMatchObject({ game: "poet", points: 260, playedAt: "2027-01-15T08:00:00.000Z" });
    expect(request.roundId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(f.sync.hasUnsent).toBe(false);
  });

  it("clips the points to the game's cap before sending, and sends nothing for a round of nothing", async () => {
    const f = fixture();
    f.sync.report("match", 90);
    f.sync.report("jigsaw", 0);
    await f.sync.flush();
    expect(f.api.postScore).toHaveBeenCalledTimes(1);
    expect((f.api.postScore.mock.calls[0] as unknown as [{ points: number }])[0].points).toBe(50);
  });

  it("keeps a round on disk while offline, and sends it on the next flush with the same round id", async () => {
    const f = fixture();
    f.api.postScore.mockRejectedValue(offline());
    f.sync.report("jigsaw", 120);
    await f.sync.flush();
    expect(f.sync.hasUnsent).toBe(true);
    const first = (f.api.postScore.mock.calls[0] as unknown as [{ roundId: string }])[0].roundId;
    // A reload finds it.
    const reopened = new ScoreSync(f.session, f.api, f.storage, now);
    expect(reopened.hasUnsent).toBe(true);
    f.api.postScore.mockResolvedValue(undefined);
    await reopened.flush();
    expect(reopened.hasUnsent).toBe(false);
    expect((f.api.postScore.mock.calls.at(-1) as unknown as [{ roundId: string }])[0].roundId).toBe(first);
  });

  it("keeps a round for a later retry after a server error or a limit, and drops it after a refusal", async () => {
    const f = fixture();
    f.api.postScore.mockRejectedValue(refused(503, "unavailable"));
    f.sync.report("listen", 60);
    await f.sync.flush();
    expect(f.sync.hasUnsent).toBe(true);
    f.api.postScore.mockRejectedValue(refused(429, "rate_limited"));
    await f.sync.flush();
    expect(f.sync.hasUnsent).toBe(true);
    f.api.postScore.mockRejectedValue(refused(400, "bad_timestamp")); // too old now: it will never be taken
    await f.sync.flush();
    expect(f.sync.hasUnsent).toBe(false);
  });

  it("counts a conflict as done", async () => {
    const f = fixture();
    f.api.postScore.mockRejectedValue(new ApiError(409, "conflict"));
    f.sync.report("daily", 100);
    await f.sync.flush();
    expect(f.sync.hasUnsent).toBe(false);
    expect(f.api.postScore).toHaveBeenCalledTimes(1);
  });

  it("sends the rounds in the order they were finished, and a failure stops the rest", async () => {
    const f = fixture();
    f.api.postScore.mockRejectedValue(offline());
    f.sync.report("poet", 20);
    f.sync.report("book", 40);
    await f.sync.flush();
    expect(f.api.postScore).toHaveBeenCalledTimes(1); // the second waited behind the first
    f.api.postScore.mockResolvedValue(undefined);
    await f.sync.flush();
    expect(f.api.postScore.mock.calls.slice(-2).map((call) => (call as unknown as [{ game: string }])[0].game)).toEqual(["poet", "book"]);
    expect(f.sync.hasUnsent).toBe(false);
  });

  it("reports the daily result with its day, and its points as a round of معمای امروز when it was solved", async () => {
    const f = fixture();
    f.sync.reportDaily(TehranDay.fromKey("2026-11-23")!, true, 2, 70);
    await f.sync.flush();
    expect(f.api.postDaily).toHaveBeenCalledWith({ date: "2026-11-23", solved: true, tries: 2 });
    expect(f.api.postScore).toHaveBeenCalledWith(expect.objectContaining({ game: "daily", points: 70 }));
  });

  it("reports a failed daily without points, with its tries kept between 1 and 3", async () => {
    const f = fixture();
    f.sync.reportDaily(TehranDay.fromKey("2026-11-23")!, false, 3, 0);
    f.sync.reportDaily(TehranDay.fromKey("2026-11-24")!, false, 9, 0);
    await f.sync.flush();
    expect(f.api.postDaily.mock.calls.map((call) => (call as unknown as [{ tries: number }])[0].tries)).toEqual([3, 3]);
    expect(f.api.postScore).not.toHaveBeenCalled();
  });

  it("does not keep a guest's rounds, but the onboarding round waits for the sign-in", async () => {
    const f = fixture(false);
    f.sync.report("poet", 100);
    expect(f.sync.hasUnsent).toBe(false);
    f.sync.report("onboarding", 50, true);
    await f.sync.flush();
    expect(f.sync.hasUnsent).toBe(true);
    expect(f.api.postScore).not.toHaveBeenCalled();
    // The sign-in lands: the round goes up.
    const signedIn = new ScoreSync(sessionOf(true), f.api, f.storage, now);
    await signedIn.flush();
    expect(signedIn.hasUnsent).toBe(false);
    expect(f.api.postScore).toHaveBeenCalledWith(expect.objectContaining({ game: "onboarding" }));
  });

  it("drops a round that was played for another account", async () => {
    const f = fixture();
    f.api.postScore.mockRejectedValue(offline());
    f.sync.report("poet", 20);
    await f.sync.flush();
    f.api.postScore.mockClear();
    const other = new ScoreSync(sessionOf(true, "someone-else"), f.api, f.storage, now);
    await other.flush();
    expect(other.hasUnsent).toBe(false);
    expect(f.api.postScore).not.toHaveBeenCalled();
  });

  it("tells when something was sent, so the points shown can be fetched again", async () => {
    const f = fixture();
    const told = vi.fn();
    f.sync.onSent = told;
    f.sync.report("poet", 20);
    await f.sync.flush();
    expect(told).toHaveBeenCalledTimes(1);
  });

  it("forgets what was waiting when it is cleared", async () => {
    const f = fixture();
    f.api.postScore.mockRejectedValue(offline());
    f.sync.report("poet", 20);
    await f.sync.flush();
    f.sync.clear();
    expect(f.sync.hasUnsent).toBe(false);
    expect(new ScoreSync(f.session, f.api, f.storage, now).hasUnsent).toBe(false);
  });
});

describe("what tells ScoreSync (GameStats)", () => {
  const stats = () => new GameStats(memoryStorage(), () => new Date("2026-11-23T10:00:00Z"));

  it("tells once when the daily puzzle is over, and not while it is being played", () => {
    const told: string[] = [];
    const game = stats();
    game.onDailyFinished = (day, solved, tries, points) => told.push(`${day.key} ${solved} ${tries} ${points}`);
    const day = TehranDay.fromKey("2026-11-23")!;
    game.record({ ...newRecord(), tries: ["a"] }, day);
    expect(told).toEqual([]);
    game.record({ ...newRecord(), tries: ["a", "b"], outcome: "solved", points: 70 }, day);
    game.record({ ...newRecord(), tries: ["a", "b"], outcome: "solved", points: 70 }, day);
    expect(told).toEqual(["2026-11-23 true 2 70"]);
    game.record({ ...newRecord(), tries: ["a", "b", "c"], outcome: "failed" }, TehranDay.fromKey("2026-11-24")!);
    expect(told.at(-1)).toBe("2026-11-24 false 3 0");
  });

  it("tells a round of a solo game with its game and points", () => {
    const told: string[] = [];
    const game = stats();
    game.onRoundFinished = (kind, points) => told.push(`${kind} ${points}`);
    game.finishRound("misra", 88);
    expect(told).toEqual(["misra 88"]);
  });
});
