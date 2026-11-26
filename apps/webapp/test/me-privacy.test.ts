import { describe, expect, it, vi } from "vitest";
import type { PrivacyPatch, PrivacySettings } from "../lib/account/api";
import { defaultPrivacy, makePatch, mergePatch, removeSent, type Patch } from "../lib/me/privacy";
import { PrivacyStore, privacyKey, privacyUnsentKey } from "../lib/me/privacyStore";
import { offline, sessionOf } from "./account";
import { memoryStorage } from "./storage";

// Ported from apps/ios/YebeytTests/AvatarAndPrivacyTests.swift (PrivacyTests).

const remote: PrivacySettings = { keptVisibility: "me", dailyVisibility: "friends", showOnline: false, inGlobalLeaderboard: true, messagesFrom: "all", gameInvitesFrom: "friends", allowReposts: false };

describe("the privacy settings", () => {
  it("default to the board's selection", () => {
    expect(defaultPrivacy).toEqual({ keptVisibility: "friends", dailyVisibility: "friends", showOnline: true, inGlobalLeaderboard: false, messagesFrom: "friends", gameInvitesFrom: "all", allowReposts: true });
  });

  it("make a patch of only what changed, and merge patches with the later winning", () => {
    expect(makePatch(defaultPrivacy, { ...defaultPrivacy, showOnline: false, allowReposts: false })).toEqual({ showOnline: false, allowReposts: false });
    expect(makePatch(defaultPrivacy, defaultPrivacy)).toEqual({});
    expect(mergePatch({ showOnline: false, messagesFrom: "all" }, { showOnline: true })).toEqual({ showOnline: true, messagesFrom: "all" });
  });

  it("keep a field changed again while it was being sent", () => {
    const sent: Patch = { showOnline: false, allowReposts: false };
    const unsent: Patch = { showOnline: true, allowReposts: false };
    expect(removeSent(unsent, sent)).toEqual({ showOnline: true });
  });
});

describe("PrivacyStore", () => {
  const fixture = (signedIn: boolean, seed: Record<string, string> = {}) => {
    const storage = memoryStorage(seed);
    const session = sessionOf(signedIn, "u1");
    const api = { privacy: vi.fn<() => Promise<PrivacySettings>>(async () => ({ ...remote })), putPrivacy: vi.fn<(patch: PrivacyPatch) => Promise<PrivacySettings>>(async () => ({ ...remote })) };
    return { storage, session, api, store: new PrivacyStore(storage, session, api) };
  };

  it("keeps a change in this browser and a guest sends nothing", async () => {
    const f = fixture(false);
    f.store.change("keptVisibility", "me");
    f.store.change("showOnline", false);
    expect(f.store.settings.keptVisibility).toBe("me");
    const reopened = new PrivacyStore(f.storage, f.session, f.api);
    expect([reopened.settings.keptVisibility, reopened.settings.showOnline, reopened.settings.messagesFrom]).toEqual(["me", false, "friends"]);
    await f.store.refresh();
    expect(f.api.putPrivacy).not.toHaveBeenCalled();
    expect(f.api.privacy).not.toHaveBeenCalled();
  });

  it("sends each change as a partial update, in order, and nothing for a change to the same value", async () => {
    const f = fixture(true);
    f.store.change("messagesFrom", "all");
    await f.store.flush();
    f.store.change("allowReposts", false);
    f.store.change("allowReposts", false);
    await f.store.flush();
    expect(f.api.putPrivacy.mock.calls).toEqual([[{ messagesFrom: "all" }], [{ allowReposts: false }]]);
    expect(f.store.hasUnsentChanges).toBe(false);
  });

  it("takes the server's settings when the screen opens", async () => {
    const f = fixture(true);
    await f.store.refresh();
    expect(f.store.settings).toEqual(remote);
    expect(f.api.privacy).toHaveBeenCalledTimes(1);
    expect(new PrivacyStore(f.storage, f.session, f.api).settings).toEqual(remote); // kept here too
  });

  it("keeps its own settings for a guest or when offline", async () => {
    const guest = fixture(false);
    await guest.store.refresh();
    expect(guest.store.settings).toEqual(defaultPrivacy);

    const away = fixture(true);
    away.api.putPrivacy.mockRejectedValue(offline());
    away.api.privacy.mockRejectedValue(offline());
    away.store.change("showOnline", false);
    await away.store.refresh();
    expect(away.store.settings.showOnline).toBe(false);
  });

  it("sends what is unsent first and does not let the server overwrite it; they survive a restart and go when back online", async () => {
    const f = fixture(true);
    f.api.putPrivacy.mockRejectedValue(offline());
    f.api.privacy.mockRejectedValue(offline());
    f.store.change("keptVisibility", "me");
    f.store.change("showOnline", false);
    await f.store.refresh();
    expect(f.store.hasUnsentChanges).toBe(true);
    expect([f.store.settings.keptVisibility, f.store.settings.showOnline]).toEqual(["me", false]); // the server's values are not taken

    const restarted = new PrivacyStore(f.storage, f.session, f.api);
    expect(restarted.hasUnsentChanges).toBe(true);

    // Back online: one update with both fields, then the server's other settings come down.
    const order: string[] = [];
    f.api.putPrivacy.mockImplementation(async (patch) => {
      order.push(`PUT ${JSON.stringify(patch)}`);
      return { ...remote };
    });
    f.api.privacy.mockImplementation(async () => {
      order.push("GET");
      return { ...defaultPrivacy, dailyVisibility: "me" };
    });
    await restarted.refresh();
    expect(order).toEqual(['PUT {"keptVisibility":"me","showOnline":false}', "GET"]);
    expect(restarted.hasUnsentChanges).toBe(false);
    expect(restarted.settings.dailyVisibility).toBe("me"); // from the server
  });

  it("does not take the server's answer when something changed while it was on its way", async () => {
    const f = fixture(true);
    let answer: () => void = () => {};
    f.api.privacy.mockImplementation(() => new Promise((resolve) => (answer = () => resolve({ ...remote }))));
    const refreshing = f.store.refresh();
    await Promise.resolve();
    await Promise.resolve();
    f.api.putPrivacy.mockRejectedValue(offline());
    f.store.change("allowReposts", false);
    answer();
    await refreshing;
    expect(f.store.settings).toEqual({ ...defaultPrivacy, allowReposts: false });
  });

  it("goes back to the defaults when cleared, and forgets what was kept", () => {
    const f = fixture(false);
    f.store.change("inGlobalLeaderboard", true);
    f.store.clear();
    expect(f.store.settings).toEqual(defaultPrivacy);
    expect(f.storage.getItem(privacyKey)).toBeNull();
    expect(f.storage.getItem(privacyUnsentKey)).toBeNull();
    expect(new PrivacyStore(f.storage, f.session, f.api).settings).toEqual(defaultPrivacy);
  });

  it("falls back to the defaults for what is kept and unreadable", () => {
    expect(fixture(false, { [privacyKey]: "{oops", [privacyUnsentKey]: "[]" }).store.settings).toEqual(defaultPrivacy);
  });
});
