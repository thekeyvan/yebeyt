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
