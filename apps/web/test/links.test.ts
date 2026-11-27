import { describe, expect, it } from "vitest";
import { challengeView, gameView, inviteView } from "../lib/links";

const creator = { username: "niloofar", displayName: "نیلوفر", avatar: null };
const challenge = { creator, game: "jigsaw" as const, items: Array.from({ length: 10 }, (_, i) => `/saadi/golestan/sh${i}#0`), score: 8, seconds: 102, label: "۱۰ بیت سعدی" };

describe("challengeView", () => {
  it("makes the labels of the board", () => {
    expect(challengeView(challenge, "7kq2")).toEqual({
      name: "نیلوفر",
      avatar: null,
      heading: "نیلوفر تو رو به چالش کشیده!",
      description: "جورچین بیت با ۱۰ بیت از سعدی. کلمه‌های هر بیت ریخته؛ به ترتیب بچسبونشون.",
      after: "بعد از نصب، همین چالش خودش باز می‌شه.",
      mine: "۸ از ۱۰",
      yours: "؟ از ۱۰",
      codeLabel: "کد چالش",
      code: "7KQ2",
      url: "https://yebeyt.com/c/7kq2",
      webUrl: "https://app.yebeyt.com/c/7kq2",
      webLabel: "روی وب بازی کن",
    });
  });

  it("describes حدس شاعر, and a challenge of several poets without a label", () => {
    const view = challengeView({ ...challenge, game: "poet", label: null, score: 10 }, "7KQ2");
    expect(view.description).toBe("حدس شاعر با ۱۰ بیت. شاعر هر بیت رو از بین چهار چهره پیدا کن.");
    expect(view.mine).toBe("۱۰ از ۱۰");
  });

  it("names the maker by the username when there is no display name", () => {
    const view = challengeView({ ...challenge, creator: { ...creator, displayName: null } }, "7KQ2");
    expect([view.name, view.heading]).toEqual(["niloofar", "niloofar تو رو به چالش کشیده!"]);
  });
});

describe("inviteView and gameView", () => {
  it("carry the creator's avatar to the page", () => {
    const avatar = { face: "tan", eyes: "happy", hair: "fire", mouth: "grin", accessory: "none", background: "sky" };
    const person = { ...creator, avatar };
    expect(inviteView(person).avatar).toEqual(avatar);
    expect(gameView({ kind: "mosh", creator: person, status: "waiting" }, "K3M9").avatar).toEqual(avatar);
    expect(challengeView({ ...challenge, creator: person }, "7KQ2").avatar).toEqual(avatar);
  });

  it("invite: the person, a line and the username as the code", () => {
    expect(inviteView(creator)).toMatchObject({
      name: "نیلوفر",
      heading: "نیلوفر دعوتت کرده به یه بیت",
      codeLabel: "نام کاربری",
      code: "niloofar",
      url: "https://yebeyt.com/i/niloofar",
    });
  });

  it("invite: opens the person's page in the web app; the other links have no web page", () => {
    expect(inviteView(creator).webUrl).toBe("https://app.yebeyt.com/u/niloofar");
    expect(inviteView({ ...creator, username: "kian_k.2" }).webUrl).toBe("https://app.yebeyt.com/u/kian_k.2");
    expect(gameView({ kind: "mosh", creator, status: "waiting" }, "k3m9").webUrl).toBeUndefined();
  });

  it("challenge: «روی وب بازی کن» opens the board in the web app, and only for a code of four letters or digits", () => {
    expect(challengeView(challenge, "7KQ2")).toMatchObject({ webUrl: "https://app.yebeyt.com/c/7KQ2", webLabel: "روی وب بازی کن" });
    expect(challengeView(challenge, "a1b2").webUrl).toBe("https://app.yebeyt.com/c/a1b2");
    for (const code of ["7KQ", "7KQ22", "7K/2", "7K 2", "../x", "7K?2", ""]) expect(challengeView(challenge, code).webUrl, code).toBeUndefined();
    expect(inviteView(creator).webLabel).toBeUndefined();
  });

  it("game: مشاعره or بازی رودررو, with the code", () => {
    expect(gameView({ kind: "mosh", creator, status: "waiting" }, "k3m9")).toMatchObject({
      heading: "نیلوفر دعوتت کرده به مشاعره",
      codeLabel: "کد بازی",
      code: "K3M9",
      url: "https://yebeyt.com/g/k3m9",
    });
    expect(gameView({ kind: "duel", creator, status: "waiting" }, "K3M9").heading).toBe("نیلوفر دعوتت کرده به بازی رودررو");
  });
});
