import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/account/api";
import { AccountDeletion } from "../lib/account/deleteAccount";
import { DivanSync } from "../lib/account/divanSync";
import { ReactionsSync } from "../lib/account/reactionsSync";
import { ScoreSync } from "../lib/account/scoreSync";
import { AccountSignOut } from "../lib/account/signOut";
import { GameStats } from "../lib/games/stats";
import { standardParts } from "../lib/me/avatarCatalogue";
import { AvatarStore } from "../lib/me/avatarStore";
import { defaultPrivacy } from "../lib/me/privacy";
import { PrivacyStore } from "../lib/me/privacyStore";
import type { DivanItem } from "../lib/reader/divan";
import { ReaderMarks } from "../lib/reader/marks";
import { offline, sessionOf, userOf } from "./account";
import { memoryStorage } from "./storage";

// Ported from apps/ios/YebeytTests/AccountLeavingTests.swift (AccountSignOut, AccountDeletion).

function fixture(deleteAnswer: () => Promise<void> = async () => {}) {
  const storage = memoryStorage();
  const session = Object.assign(sessionOf(true, "u1"), {
    update: vi.fn(),
    signOut: vi.fn(async () => {
      session.isSignedIn = false;
      session.user = undefined;
    }),
  });
  const server = {
    divan: vi.fn<() => Promise<DivanItem[]>>(async () => []),
    putDivan: vi.fn<(items: DivanItem[]) => Promise<DivanItem[]>>(async () => []),
    setReaction: vi.fn(async () => undefined),
    myReactions: vi.fn(async () => ({ items: [], nextCursor: null })),
    postScore: vi.fn(async () => undefined),
    postDaily: vi.fn(async () => undefined),
    setAvatar: vi.fn(async () => userOf("u1")),
    privacy: vi.fn(async () => ({ ...defaultPrivacy })),
    putPrivacy: vi.fn(async () => ({ ...defaultPrivacy })),
    deleteAccount: vi.fn(deleteAnswer),
  };
  const marks = new ReaderMarks(storage, () => 2_000);
  const stats = new GameStats(storage, () => new Date("2026-11-23T10:00:00Z"));
  const divan = new DivanSync(marks, session, server, 60_000);
  const reactions = new ReactionsSync(marks, session, server, storage);
  const scores = new ScoreSync(session, server, storage);
  const privacy = new PrivacyStore(storage, session, server);
  const avatar = new AvatarStore(storage, session, server);
  const data = { marks, stats, reactions, scores, divan, privacy, avatar };
  return { storage, session, server, ...data, leaving: new AccountSignOut(session, data), deletion: new AccountDeletion(session, server, data) };
}

type Fixture = ReturnType<typeof fixture>;

/** What an account has made in this browser: a kept couplet, a like, a privacy setting, a face. */
function fill(f: Fixture) {
  f.marks.toggle("kept", "/a/b/c", 0);
  f.marks.toggle("liked", "/a/b/c", 1);
  f.privacy.change("allowReposts", false);
  f.avatar.save({ ...standardParts, hair: "fire" });
}

function expectNothingLeft(f: Fixture) {
  expect(f.marks.divanItems()).toEqual([]);
  expect(f.marks.keys("liked").size).toBe(0);
  expect(f.reactions.hasUnsent).toBe(false);
  expect(f.scores.hasUnsent).toBe(false);
  expect(f.privacy.settings).toEqual(defaultPrivacy);
  expect(f.avatar.parts).toEqual(standardParts);
  expect(f.avatar.isUnsent).toBe(false);
  expect(f.storage.getItem("me.avatar")).toBeNull();
  expect(f.storage.getItem("me.privacy")).toBeNull();
}

describe("AccountSignOut (Me/Settings/AccountLeaving.swift)", () => {
  it("syncs once more, then forgets the account's data here: the divan, the likes, the privacy settings, the face", async () => {
    const f = fixture();
    fill(f);
    f.stats.award(100);
    f.stats.claim("u1");
    expect(await f.leaving.signOut()).toBe("done");
    // Everything made here reached the account before it was left.
    expect(f.server.putDivan).toHaveBeenCalledWith([expect.objectContaining({ key: "/a/b/c#0" })]);
    expect(f.server.setReaction).toHaveBeenCalled();
    expect(f.server.putPrivacy).toHaveBeenCalledWith({ allowReposts: false });
    expect(f.server.setAvatar).toHaveBeenCalledWith(expect.objectContaining({ hair: "fire" }));
    expect(f.session.signOut).toHaveBeenCalledTimes(1);
    expectNothingLeft(f);
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
    fill(f);
    await f.leaving.signOut();
    f.server.divan.mockClear();
    expect(await f.leaving.signOut(true)).toBe("done");
    expect(f.server.divan).not.toHaveBeenCalled();
    expect(f.session.isSignedIn).toBe(false);
    expectNothingLeft(f);
  });

  it("is held back by unsent likes and unsent scores too", async () => {
    const likes = fixture();
    likes.server.setReaction.mockRejectedValue(offline());
    likes.marks.toggle("liked", "/a/b/c", 1);
    expect(await likes.leaving.signOut()).toBe("unsynced");
    expect(likes.reactions.hasUnsent && likes.marks.keys("liked").size === 1).toBe(true);
    expect(await likes.leaving.signOut(true)).toBe("done");
    expectNothingLeft(likes);

    const scores = fixture();
    scores.server.postScore.mockRejectedValue(new ApiError(503, "unavailable"));
    scores.scores.report("poet", 40);
    expect(await scores.leaving.signOut()).toBe("unsynced");
    expect(await scores.leaving.signOut(true)).toBe("done");
    expect(scores.scores.hasUnsent).toBe(false);
  });

  it("lets scores that reach the server go without a warning", async () => {
    const f = fixture();
    f.scores.report("poet", 40);
    expect(await f.leaving.signOut()).toBe("done");
    expect(f.server.postScore).toHaveBeenCalledTimes(1);
  });

  it("is held back by an unsent privacy change or an unsent face too", async () => {
    const privacy = fixture();
    privacy.server.putPrivacy.mockRejectedValue(offline());
    privacy.privacy.change("showOnline", false);
    expect(await privacy.leaving.signOut()).toBe("unsynced");
    expect(privacy.session.isSignedIn).toBe(true);
    expect(privacy.privacy.hasUnsentChanges).toBe(true);

    const face = fixture();
    face.server.setAvatar.mockRejectedValue(offline());
    face.avatar.save({ ...standardParts, eyes: "wink" });
    expect(await face.leaving.signOut()).toBe("unsynced");
    expect(face.avatar.isUnsent).toBe(true);
    expect(await face.leaving.signOut(true)).toBe("done");
    expectNothingLeft(face);
  });

  it("holds the points back for the next account: only what is earned afterwards is offered", async () => {
    const f = fixture();
    f.stats.award(100);
    f.stats.claim("u1");
    await f.leaving.signOut();
    f.stats.award(30);
    expect(f.stats.guestPoints).toBe(30);
    expect(f.stats.claim("second")).toBe(true);
    expect(f.stats.claim("u1")).toBe(false);
  });
});

describe("AccountDeletion", () => {
  it("sends the call, signs out, and forgets the account's data", async () => {
    const f = fixture();
    fill(f);
    expect(await f.deletion.delete()).toBeUndefined();
    expect(f.server.deleteAccount).toHaveBeenCalledTimes(1);
    expect(f.session.isSignedIn).toBe(false);
    expectNothingLeft(f);
  });

  it("keeps the account and its data, and says so, when the server cannot do it", async () => {
    const f = fixture(async () => Promise.reject(new ApiError(502)));
    fill(f);
    await f.server.setAvatar.mockClear();
    expect(await f.deletion.delete()).toBe(new ApiError(502).persianMessage);
    expect(f.session.isSignedIn).toBe(true);
    expect([...f.marks.keys("kept")]).toEqual(["/a/b/c#0"]);
    expect([...f.marks.keys("liked")]).toEqual(["/a/b/c#1"]);
    expect(f.privacy.settings.allowReposts).toBe(false);
    expect(f.avatar.parts.hair).toBe("fire");
  });

  it("says «الان نشد…» when Apple cannot be reached to revoke its token, and keeps the account and its data", async () => {
    const f = fixture(async () => Promise.reject(new ApiError(502, "apple_revoke_failed")));
    fill(f);
    expect(await f.deletion.delete()).toBe("الان نشد، یه کم دیگه دوباره امتحان کن");
    expect(f.session.isSignedIn).toBe(true);
    expect([...f.marks.keys("kept")]).toEqual(["/a/b/c#0"]);
    expect([...f.marks.keys("liked")]).toEqual(["/a/b/c#1"]);
    expect(f.privacy.settings.allowReposts).toBe(false);
    expect(f.avatar.parts.hair).toBe("fire");
  });

  it("says there is no network and changes nothing when the server is not reached", async () => {
    const f = fixture(async () => Promise.reject(offline()));
    f.marks.toggle("kept", "/a/b/c", 0);
    expect(await f.deletion.delete()).toBe(offline().persianMessage);
    expect(f.session.isSignedIn).toBe(true);
    expect(f.marks.keys("kept").size).toBe(1);
  });

  it("says something went wrong for a failure that is not the server's", async () => {
    const f = fixture(async () => Promise.reject(new Error("boom")));
    expect(await f.deletion.delete()).toBe(new ApiError(500).persianMessage);
    expect(f.session.isSignedIn).toBe(true);
  });

  it("waits for a sync on its way, so nothing lands after the clearing", async () => {
    const f = fixture();
    f.server.divan.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return [{ key: "/z/z/z#0", keptAt: 1_000 }];
    });
    const running = f.divan.syncNow();
    await new Promise((resolve) => setTimeout(resolve, 5)); // the GET is on its way
    expect(await f.deletion.delete()).toBeUndefined();
    await running;
    expectNothingLeft(f); // the server's answer did not put the couplet back
  });

  it("releases the account's points too", async () => {
    const f = fixture();
    f.stats.award(50);
    f.stats.claim("u1");
    await f.deletion.delete();
    expect(f.stats.owner).toBeUndefined();
    expect(f.stats.guestPoints).toBe(0);
  });
});
