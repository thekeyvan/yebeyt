import { describe, expect, it, vi } from "vitest";
import type { AvatarParts } from "@yebeyt/avatar";
import { accessories, accessoryUnlockText, choosing, isUnlocked, isValidParts, optionsFor, partChips, spokenFace, standardParts } from "../lib/me/avatarCatalogue";
import { AvatarStore, avatarKey, avatarUnsentKey } from "../lib/me/avatarStore";
import { offline, sessionOf, userOf, settle } from "./account";
import { memoryStorage } from "./storage";

// Ported from apps/ios/YebeytTests/AvatarAndPrivacyTests.swift (AvatarTests).

describe("the avatar catalogue", () => {
  it("starts everyone with the board's face", () => {
    expect(standardParts).toEqual({ face: "peach", eyes: "round", hair: "dark", mouth: "smile", accessory: "ney", background: "sun" });
    expect(isValidParts(standardParts)).toBe(true);
  });

  it("has the board's six accessories in order, with their names", () => {
    expect(accessories.map((item) => item.title)).toEqual(["هیچی", "نیِ مولانا", "گل سرخِ حافظ", "تاجِ شاهنامه", "کلاه‌خودِ رستم", "شمع و پروانه"]);
    expect(optionsFor("accessory")).toHaveLength(6);
  });

  it("says the face for screen readers, with the accessory", () => {
    expect(spokenFace(standardParts)).toBe("چهره‌ی تو، با نیِ مولانا");
    expect(spokenFace({ ...standardParts, accessory: "none" })).toBe("چهره‌ی تو");
  });

  it("has three variants of eyes and of mouth, and the board's chips", () => {
    expect(optionsFor("eyes")).toHaveLength(3);
    expect(optionsFor("mouth")).toHaveLength(3);
    expect(partChips.map((chip) => chip.title)).toEqual(["صورت", "چشم", "مو", "دهن", "کلاه و همراه", "زمینه"]);
  });

  it("has a title for every option and ids of the contract's shape", () => {
    for (const { part } of partChips) {
      for (const option of optionsFor(part)) {
        expect(option.id, `${part}: ${option.id}`).toMatch(/^[a-z0-9-]{1,32}$/);
        expect(option.title, `${part}: ${option.id}`).not.toBe("");
      }
    }
  });

  it("calls a face with an unknown part not valid", () => {
    expect(isValidParts({ ...standardParts, eyes: "laser" })).toBe(false);
  });

  it("opens the first three accessories, the crown with five book wins, the candle with a seven-day streak", () => {
    const none = { bookWins: 0, bestStreak: 0 };
    expect((["none", "ney", "rose"] as const).every((id) => isUnlocked(id, none))).toBe(true);
    expect(isUnlocked("crown", { bookWins: 4, bestStreak: 0 })).toBe(false);
    expect(isUnlocked("crown", { bookWins: 5, bestStreak: 0 })).toBe(true);
    expect(isUnlocked("candle", { bookWins: 0, bestStreak: 6 })).toBe(false);
    expect(isUnlocked("candle", { bookWins: 0, bestStreak: 7 })).toBe(true);
  });

  it("keeps the helmet locked whatever is done", () => {
    expect(isUnlocked("helmet", { bookWins: 999, bestStreak: 999 })).toBe(false);
  });

  it("shows the board's unlock text under a locked item", () => {
    expect(accessoryUnlockText("crown")).toBe("۵ برد توی «از کدوم کتاب؟»");
    expect(accessoryUnlockText("helmet")).toBe("لیگ سخن‌دان");
    expect(accessoryUnlockText("candle")).toBe("۷ روز پشت‌سرهم");
    expect(accessoryUnlockText("ney")).toBeUndefined();
  });

  it("does not let a locked accessory be chosen, but an open one, and only ids it has", () => {
    const none = { bookWins: 0, bestStreak: 0 };
    expect(choosing("crown", "accessory", standardParts, none)).toBeUndefined();
    expect(choosing("crown", "accessory", standardParts, { bookWins: 5, bestStreak: 0 })?.accessory).toBe("crown");
    expect(choosing("rose", "accessory", standardParts, none)?.accessory).toBe("rose");
    expect(choosing("happy", "eyes", standardParts, none)?.eyes).toBe("happy");
    expect(choosing("laser", "eyes", standardParts, none)).toBeUndefined();
  });
});

describe("AvatarStore", () => {
  const fixture = (signedIn: boolean, seed: Record<string, string> = {}) => {
    const storage = memoryStorage(seed);
    const session = Object.assign(sessionOf(signedIn, "u1"), { update: vi.fn() });
    const api = { setAvatar: vi.fn(async () => userOf("u1")) };
    return { storage, session, api, store: new AvatarStore(storage, session, api) };
  };
  const mine: AvatarParts = { ...standardParts, eyes: "wink" };

  it("starts with the standard face", () => {
    expect(fixture(false).store.parts).toEqual(standardParts);
  });

  it("keeps a saved face in this browser, and a guest sends nothing", async () => {
    const f = fixture(false);
    const parts = { ...standardParts, hair: "fire", accessory: "rose" };
    f.store.save(parts);
    await f.store.flush();
    expect(f.store.parts).toEqual(parts);
    expect(f.api.setAvatar).not.toHaveBeenCalled();
    expect(new AvatarStore(f.storage, f.session, f.api).parts).toEqual(parts);
  });

  it("sends the six parts at once when signed in, after saving here", async () => {
    const f = fixture(true);
    f.store.save({ ...standardParts, mouth: "grin" });
    expect(f.store.parts.mouth).toBe("grin"); // saved at once, before anything is sent
    await f.store.flush();
    expect(f.api.setAvatar).toHaveBeenCalledWith({ face: "peach", eyes: "round", hair: "dark", mouth: "grin", accessory: "ney", background: "sun" });
    expect(f.session.update).toHaveBeenCalledTimes(1);
    expect(f.store.isUnsent).toBe(false);
  });

  it("falls back to the standard face for a saved one that is not in the catalogue", () => {
    const bad = JSON.stringify({ ...standardParts, face: "purple" });
    expect(fixture(false, { [avatarKey]: bad }).store.parts).toEqual(standardParts);
    expect(fixture(false, { [avatarKey]: "{oops" }).store.parts).toEqual(standardParts);
  });

  it("takes the server's face when this browser never changed one", async () => {
    const f = fixture(true);
    const remote = { ...standardParts, background: "mint" };
    await f.store.reconcile({ ...userOf("u1"), avatar: remote });
    expect(f.store.parts).toEqual(remote);
    expect(f.api.setAvatar).not.toHaveBeenCalled();
    expect(new AvatarStore(f.storage, f.session, f.api).parts).toEqual(remote); // kept here too
  });

  it("sends a face made here, when the server has none", async () => {
    const f = fixture(true);
    f.api.setAvatar.mockRejectedValue(offline());
    f.store.save(mine);
    await f.store.flush();
    expect(f.store.isUnsent).toBe(true); // the server did not take it
    f.api.setAvatar.mockResolvedValue(userOf("u1"));
    const before = f.api.setAvatar.mock.calls.length;
    await f.store.reconcile({ ...userOf("u1"), avatar: null });
    expect(f.api.setAvatar).toHaveBeenCalledTimes(before + 1);
    expect(f.store.parts).toEqual(mine);
    expect(f.store.isUnsent).toBe(false); // sent now
  });

  it("does not overwrite a face changed on another device with an old one here", async () => {
    const f = fixture(true);
    f.store.save({ ...standardParts, hair: "lapis" });
    await f.store.flush();
    expect(f.store.isUnsent).toBe(false);
    const newer = { ...standardParts, background: "mint" };
    await f.store.reconcile({ ...userOf("u1"), avatar: newer }); // the other device's
    expect(f.store.parts).toEqual(newer);
    expect(f.api.setAvatar).toHaveBeenCalledTimes(1); // nothing sent
  });

  it("sends a face saved but never received before taking the server's", async () => {
    const f = fixture(true);
    f.api.setAvatar.mockRejectedValue(offline());
    f.store.save({ ...standardParts, eyes: "happy" });
    await f.store.flush();
    expect(f.store.isUnsent).toBe(true);
    f.api.setAvatar.mockResolvedValue(userOf("u1"));
    await f.store.reconcile({ ...userOf("u1"), avatar: { ...standardParts, background: "rose" } });
    expect(f.store.parts.eyes).toBe("happy");
    expect(f.api.setAvatar).toHaveBeenLastCalledWith(expect.objectContaining({ eyes: "happy" }));
    expect(f.store.isUnsent).toBe(false);
  });

  it("keeps the face unsent when it changed again while a send was on its way", async () => {
    const f = fixture(true);
    let release: () => void = () => {};
    f.api.setAvatar.mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve(userOf("u1")))));
    f.store.save({ ...standardParts, eyes: "happy" });
    await settle();
    f.api.setAvatar.mockImplementation(async () => userOf("u1"));
    f.store.save({ ...standardParts, eyes: "wink" });
    release();
    await f.store.flush();
    expect(f.store.parts.eyes).toBe("wink");
    expect(f.api.setAvatar).toHaveBeenLastCalledWith(expect.objectContaining({ eyes: "wink" }));
    expect(f.store.isUnsent).toBe(false);
  });

  it("goes back to the standard face when cleared, and forgets it", () => {
    const f = fixture(false);
    f.store.save({ ...standardParts, face: "tan" });
    f.store.clear();
    expect(f.store.isUnsent).toBe(false);
    expect(f.store.parts).toEqual(standardParts);
    expect(f.storage.getItem(avatarKey)).toBeNull();
    expect(f.storage.getItem(avatarUnsentKey)).toBeNull();
    expect(new AvatarStore(f.storage, f.session, f.api).parts).toEqual(standardParts);
  });
});
