import { describe, expect, it } from "vitest";
import { ApiError } from "../lib/account/api";
import { GameDeck, coupletId, type GameCouplet } from "../lib/games/couplet";
import { JigsawRound } from "../lib/games/jigsawRound";
import { poetItemsRound } from "../lib/games/quizRounds";
import { SeededGenerator } from "../lib/games/seeded";
import { boardPath, codeIn, codeOfUrl, linked } from "../lib/play/challengeLink";
import { isInDeck, offerOf, type ChallengeOffer } from "../lib/play/challengeOffer";
import { ChallengeAccept, ChallengeSender, cleaned, coupletsOf, outcomeOf } from "../lib/play/challengeModels";
import { playCopy } from "../lib/play/copy";
import type { Challenge } from "../lib/play/models";
import { deck, poets } from "./quizFixtures";

// The ports of ChallengeLinkTests (ChatGameLineTests.swift) and ChallengeModelTests (PlayLobbyChallengeTests.swift).

describe("the link of a challenge", () => {
  it("is found in the line of a chat", () => {
    expect(codeIn("نیلوفر تو رو به جورچین بیت چالش کشید · yebeyt.com/c/7KQ2")).toBe("7KQ2");
    expect(codeIn("https://yebeyt.com/c/7kq2 ببین")).toBe("7kq2");
    expect(codeIn("https://www.yebeyt.com/c/AB12")).toBe("AB12");
  });

  it("is not in a text without one", () => {
    expect(codeIn("سلام")).toBeUndefined();
    expect(codeIn("yebeyt.com/i/sara")).toBeUndefined(); // an invite link is another thing
    expect(codeIn("yebeyt.com/c/7KQ2X")).toBeUndefined(); // five characters are not a code
    expect(codeIn("other.com/c/7KQ2")).toBeUndefined();
  });

  it("gives the code of a tapped address", () => {
    expect(codeOfUrl("https://yebeyt.com/c/7KQ2")).toBe("7KQ2");
    expect(codeOfUrl("https://example.com")).toBeUndefined();
    expect(boardPath("7KQ2")).toBe("/c/7KQ2");
  });

  it("is made a link in a text, and the text stays the same", () => {
    const text = "چالش · yebeyt.com/c/7KQ2";
    const parts = linked(text);
    expect(parts.filter((part) => part.code)).toEqual([{ text: "yebeyt.com/c/7KQ2", code: "7KQ2" }]);
    expect(parts.map((part) => part.text).join("")).toBe(text);
    expect(linked("سلام")).toEqual([{ text: "سلام" }]);
    expect(linked("yebeyt.com/c/AB12 و yebeyt.com/c/CD34 تموم").map((part) => part.code)).toEqual(["AB12", undefined, "CD34", undefined]);
  });
});

const items = Array.from({ length: 10 }, (_, number) => `/saadi/divan/ghazals/sh${number + 1}#0`);
const saadi = (key: string): GameCouplet => ({ poem: key.split("#")[0]!, index: 0, m1: "بنی آدم اعضای یکدیگرند", m2: "که در آفرینش ز یک گوهرند", poetSlug: "saadi", poetName: "سعدی", bookTitle: "", bookPath: "", meaningIsAI: false });
const offer = (invite: string[] = []): ChallengeOffer => offerOf("jigsaw", items.map(saadi), 8, 102, invite)!;

describe("making a challenge", () => {
  const sender = (answer: () => Promise<{ code: string; url: string }>, invite: string[] = []) => {
    const asked: unknown[][] = [];
    const sent: string[] = [];
    const made = new ChallengeSender(offer(invite), { createChallenge: async (...args) => (asked.push(args), answer()) }, "نیلوفر", async (text, username) => (sent.push(`${username}: ${text}`), undefined));
    return { made, asked, sent };
  };
  const ok = async () => ({ code: "7KQ2", url: "https://yebeyt.com/c/7KQ2" });

  it("is a round of ten with its game, its score and its time", () => {
    expect(offer()).toMatchObject({ items, score: 8, seconds: 102, label: "۱۰ بیت سعدی" });
    expect(offerOf("poet", [], 1, 1)).toBeUndefined();
  });

  it("is made once whatever how often the card shows", async () => {
    const { made, asked } = sender(ok);
    await made.create();
    await made.create();
    expect(asked).toEqual([["jigsaw", items, 8, 102]]);
    expect([made.created?.code, made.linkText]).toEqual(["7KQ2", "yebeyt.com/c/7KQ2"]);
  });

  it("has the text of the card and the share follow the board", async () => {
    const { made } = sender(ok);
    expect([made.share, made.linkText]).toEqual([undefined, "yebeyt.com/c/····"]);
    await made.create();
    expect(made.brag).toBe("نیلوفر توی جورچین بیت ۸ از ۱۰ گرفت. تو چند می‌گیری؟");
    expect(made.share).toEqual({ text: `${made.brag}\nhttps://yebeyt.com/c/7KQ2`, url: "https://yebeyt.com/c/7KQ2" });
  });

  it("sends the link as a chat message to the friends picked in the lobby", async () => {
    const { made, sent } = sender(ok, ["sara.ghazal", "kian_k"]);
    await made.create();
    await made.create();
    expect(sent).toEqual(["sara.ghazal: نیلوفر تو رو به جورچین بیت چالش کشید · yebeyt.com/c/7KQ2", "kian_k: نیلوفر تو رو به جورچین بیت چالش کشید · yebeyt.com/c/7KQ2"]);
    expect(made.snapshot().sent).toEqual(["sara.ghazal", "kian_k"]);
  });

  it("sends to a friend chosen on the card once, and nothing before it exists", async () => {
    const { made, sent } = sender(ok);
    expect(await made.send("sara.ghazal")).toBe(playCopy.challengePending);
    await made.create();
    expect(await made.send("sara.ghazal")).toBeUndefined();
    expect(await made.send("sara.ghazal")).toBeUndefined();
    expect(sent).toHaveLength(1);
  });

  it("is tried again after a failure", async () => {
    let calls = 0;
    const { made } = sender(async () => (++calls === 1 ? Promise.reject(new ApiError(429, "rate_limited")) : ok()));
    await made.create();
    expect(made.snapshot().phase).toEqual({ kind: "failed", line: new ApiError(429, "rate_limited").persianMessage });
    await made.create();
    expect(made.created?.code).toBe("7KQ2");
  });
});

describe("answering a challenge", () => {
  const challenge: Challenge = { creator: { username: "nila", displayName: "نیلوفر", avatar: null }, game: "jigsaw", items, score: 8, seconds: 102, label: "۱۰ بیت سعدی" };
  const accept = (api: Partial<ConstructorParameters<typeof ChallengeAccept>[1]>, hasAccount = false) =>
    new ChallengeAccept("7KQ2", { challenge: async () => challenge, postChallengeResult: async () => {}, ...api }, () => hasAccount);

  it("loads without an account and asks for a name", async () => {
    const asked: string[] = [];
    const model = accept({ challenge: async (code) => (asked.push(code), challenge) });
    await model.load();
    expect([model.challenge?.creator.displayName, model.challenge?.score, asked]).toEqual(["نیلوفر", 8, ["7KQ2"]]);
    expect(model.asksName).toBe(true);
  });

  it("says so for an unknown or expired code", async () => {
    const model = accept({ challenge: async () => Promise.reject(new ApiError(404, "not_found")) });
    await model.load();
    expect(model.snapshot()).toEqual({ kind: "failed", line: playCopy.challengeGone });
  });

  it("leaves the cleaned name of a guest with the result", async () => {
    const posted: unknown[][] = [];
    const model = accept({ postChallengeResult: async (...args) => void posted.push(args) });
    expect(await model.post(7, 90, "  کیان  ")).toBeUndefined();
    expect(posted).toEqual([["7KQ2", 7, 90, "کیان"]]);
  });

  it("sends nothing for a guest without a name", async () => {
    const posted: unknown[][] = [];
    const model = accept({ postChallengeResult: async (...args) => void posted.push(args) });
    expect([await model.post(7, 90, "   "), await model.post(7, 90)]).toEqual([playCopy.nameNeeded, playCopy.nameNeeded]);
    expect(posted).toEqual([]);
  });

  it("cuts the name to thirty characters", () => {
    expect([...cleaned("ا".repeat(40))!]).toHaveLength(30);
    expect(cleaned("\n ")).toBeUndefined();
  });

  it("posts a signed-in player's result with no name", async () => {
    const posted: unknown[][] = [];
    const model = accept({ postChallengeResult: async (...args) => void posted.push(args) }, true);
    expect(model.asksName).toBe(false);
    expect(await model.post(9, 80)).toBeUndefined();
    expect(posted).toEqual([["7KQ2", 9, 80]]);
  });

  it("takes a second result for done, not a failure", async () => {
    expect(await accept({ postChallengeResult: async () => Promise.reject(new ApiError(409, "conflict")) }, true).post(9, 80)).toBeUndefined();
  });

  it("gives another failure's line", async () => {
    const error = new ApiError(429, "rate_limited");
    expect(await accept({ postChallengeResult: async () => Promise.reject(error) }, true).post(9, 80)).toBe(error.persianMessage);
  });

  it("opens only with all ten of its couplets playable", () => {
    const all = deck();
    const slugs = new Set(poets.map((poet) => poet.slug));
    const asChallenge = (game: "jigsaw" | "poet", keys: string[]): Challenge => ({ ...challenge, game, items: keys });
    const keys = all.couplets.slice(0, 10).map(coupletId);
    expect(coupletsOf(asChallenge("jigsaw", keys), all, slugs)?.map(coupletId)).toEqual(keys);
    expect(coupletsOf(asChallenge("poet", keys), all, slugs)).toHaveLength(10);
    expect(coupletsOf(asChallenge("jigsaw", [...keys.slice(0, 9), "/nowhere/p#0"]), all, slugs)).toBeUndefined(); // not in the deck
    expect(coupletsOf(asChallenge("jigsaw", keys.slice(0, 9)), all, slugs)).toBeUndefined(); // nine
    expect(coupletsOf(asChallenge("poet", keys), all, new Set(["nobody"]))).toBeUndefined(); // no poets to choose from
    const unplayable: GameCouplet = { ...saadi("/x/y#0"), m1: "الف", m2: "ب" };
    const short = new GameDeck([...all.couplets.slice(0, 9), unplayable]);
    const shortKeys = short.couplets.map(coupletId);
    expect(coupletsOf(asChallenge("jigsaw", shortKeys), short, slugs)).toBeUndefined(); // one word: a jigsaw can't be made of it
    expect(coupletsOf(asChallenge("poet", shortKeys), short, slugs)).toHaveLength(10);
  });

  it("is no challenge when the round has a couplet outside the deck", () => {
    const all = deck();
    const outside: GameCouplet = { ...saadi("/hafez/ghazal/sh1#0"), m1: "الف ب", m2: "ج د ه و" };
    expect(isInDeck(offerOf("jigsaw", [...all.couplets.slice(0, 9), outside], 5, 60)!, all)).toBe(false);
    expect(isInDeck(offerOf("jigsaw", all.couplets.slice(0, 10), 5, 60)!, all)).toBe(true);
  });

  it("is won with more than the maker's score", () => {
    expect([outcomeOf(9, 8), outcomeOf(8, 8), outcomeOf(7, 8)]).toEqual(["won", "draw", "lost"]);
    expect(playCopy.scores(7, "نیلوفر", 8)).toBe("تو ۷ · نیلوفر ۸");
    expect(playCopy.toWin(8)).toBe("بیشتر از ۸ تا بگیری، تو بردی.");
  });

  it("says the words of the boards", () => {
    expect([playCopy.fromLink("نیلوفر"), playCopy.waitingForYou("نیلوفر"), playCopy.outOfTen(8), playCopy.challengeResult("سارا", 7)]).toEqual(["از لینک نیلوفر", "نیلوفر منتظرته", "۸ از ۱۰", "سارا توی چالشت ۷ از ۱۰ گرفت"]);
  });

  it("plays the challenge's couplets in order: the jigsaw takes them as its opening, and so does the poet game", () => {
    const all = deck();
    const wanted = [all.couplets[5]!, all.couplets[2]!, all.couplets[40]!];
    const generator = new SeededGenerator(3n);
    expect(JigsawRound.make(wanted, all, generator)?.questions.slice(0, 3).map((question) => coupletId(question.couplet))).toEqual(wanted.map(coupletId));
    expect(poetItemsRound(wanted, poets, generator)?.questions.map((question) => coupletId(question.couplet))).toEqual(wanted.map(coupletId));
  });
});
