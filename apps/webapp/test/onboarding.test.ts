import { describe, expect, it } from "vitest";
import { debugStep, OnboardingModel, onboardingDoneKey, onboardingSteps, barIndex, barLabels, type OnboardingStep } from "../lib/onboarding/model";
import { Taste, tasteMoods, tasteMoodsKey, tastePoetsKey } from "../lib/onboarding/taste";
import { OnboardingGame, onboardingReward } from "../lib/onboarding/game";
import { SeededGenerator } from "../lib/games/seeded";
import { GameDeck } from "../lib/games/couplet";
import { couplet } from "./games";
import { memoryStorage } from "./storage";

describe("OnboardingModel (Onboarding/OnboardingModel.swift)", () => {
  const model = (start: OnboardingStep | undefined = "welcome", storage = memoryStorage()) => ({ storage, onboarding: new OnboardingModel(start, storage) });

  it("goes through the steps in order, and the last ends it", () => {
    const { storage, onboarding } = model();
    const seen: OnboardingStep[] = [];
    while (onboarding.step) {
      seen.push(onboarding.step);
      if (onboarding.step === "account") onboarding.signedIn(true);
      else onboarding.next();
    }
    expect(seen).toEqual(["welcome", "taste", "game", "account", "username", "friends"]);
    expect(onboarding.isRunning).toBe(false);
    expect(storage.getItem(onboardingDoneKey)).toBe("true");
  });

  it("goes one step on with «رد شو», and the account step ends it", () => {
    const { storage, onboarding } = model("taste");
    onboarding.next(); // «رد شو» on the taste step
    expect(onboarding.step).toBe("game");
    onboarding.next(); // «رد شو» on the game
    expect(onboarding.step).toBe("account");
    expect(onboarding.gameWon).toBe(false);
    onboarding.next(); // «رد شو» on the account step: no account, to the home screen
    expect(onboarding.step).toBeUndefined();
    expect(storage.getItem(onboardingDoneKey)).toBe("true");
  });

  it("sends a returning person straight to the account step", () => {
    const { onboarding } = model();
    onboarding.signIn();
    expect(onboarding.step).toBe("account");
    onboarding.signedIn(false); // they have a username already: nothing more to ask
    expect(onboarding.step).toBeUndefined();
  });

  it("lets a new account pick its username, then see the invite link", () => {
    const { onboarding } = model("account");
    onboarding.signedIn(true);
    expect(onboarding.step).toBe("username");
    onboarding.next();
    expect(onboarding.step).toBe("friends");
    onboarding.finish();
    expect(onboarding.step).toBeUndefined();
  });

  it("remembers a won game for the account step", () => {
    const won = model("game").onboarding;
    won.gameEnded(true);
    expect(won.step).toBe("account");
    expect(won.gameWon).toBe(true);
    const lost = model("game").onboarding;
    lost.gameEnded(false);
    expect(lost.step === "account" && !lost.gameWon).toBe(true);
  });

  it("ignores events from other steps", () => {
    const { onboarding } = model("welcome");
    onboarding.gameEnded(true);
    onboarding.signedIn(true);
    expect(onboarding.step === "welcome" && !onboarding.gameWon).toBe(true);
    onboarding.signIn();
    onboarding.signIn();
    expect(onboarding.step).toBe("account");
  });

  it("marks onboarding done when someone signs in, so a reload keeps the account", () => {
    const { storage, onboarding } = model("account");
    onboarding.signedIn(true);
    expect(OnboardingModel.firstStep(storage)).toBeUndefined();
  });

  it("shows on the first visit only", () => {
    const storage = memoryStorage();
    expect(OnboardingModel.firstStep(storage)).toBe("welcome");
    model("welcome", storage).onboarding.finish();
    expect(OnboardingModel.firstStep(storage)).toBeUndefined();
  });

  it("has a bar for taste, game and account only", () => {
    expect(onboardingSteps.map(barIndex)).toEqual([undefined, 0, 1, 2, undefined, undefined]);
    expect(barLabels).toEqual(["سلیقه", "اولین بازی", "حساب"]);
  });
});

describe("the debug start (the phone's -beytOnboarding)", () => {
  const session = (value: string | null) => ({ getItem: () => value });

  it("starts at the named step, whatever was done before", () => {
    expect(debugStep(session("friends"), true)).toBe("friends");
    expect(debugStep(session("welcome"), true)).toBe("welcome");
  });

  it("is `first` for a release build's behaviour, and nothing otherwise", () => {
    expect(debugStep(session("first"), true)).toBe("first");
    expect(debugStep(session(null), true)).toBeUndefined();
    expect(debugStep(session("nonsense"), true)).toBeUndefined();
  });

  it("is never there in a build without the debug pages", () => {
    expect(debugStep(session("taste"), false)).toBeUndefined();
  });
});

describe("Taste (Onboarding/Taste.swift)", () => {
  it("keeps the choices in this browser", () => {
    const storage = memoryStorage();
    const taste = new Taste(storage);
    taste.togglePoet("hafez");
    taste.togglePoet("saadi");
    taste.togglePoet("saadi"); // a second tap takes it back
    taste.toggleMood("love");
    taste.toggleMood("longing");
    expect([...taste.poets]).toEqual(["hafez"]);
    const again = new Taste(storage);
    expect([...again.poets]).toEqual(["hafez"]);
    expect([...again.moods].sort()).toEqual(["longing", "love"]);
    expect(JSON.parse(storage.getItem(tastePoetsKey)!)).toEqual(["hafez"]); // the home reads this
    expect(JSON.parse(storage.getItem(tasteMoodsKey)!)).toEqual(["longing", "love"]);
  });

  it("has the board's moods in its order", () => {
    expect(tasteMoods.map((mood) => mood.title)).toEqual(["عاشقانه", "امید", "دلتنگی", "عرفانی", "طنز", "حماسی", "طبیعت"]);
  });
});

describe("OnboardingGame (Onboarding/OnboardingGame.swift)", () => {
  const couplets = () => [
    couplet(1, { m2: "که در آفرینش ز یک گوهرند", poet: "saadi" }), // five words
    couplet(2, { m2: "که عشق آسان نمود اول ولی افتاد مشکل‌ها", poet: "hafez" }), // eight words: too long
    couplet(3, { m2: "چو عضوی به درد آورد روزگار", poet: "saadi" }),
    couplet(4, { m2: "دو", poet: "hafez" }), // too short to play
    couplet(5, { m2: "به نام خداوند جان و خرد", poet: "ferdousi" }),
  ];
  const make = (preferring: string[] = [], seed = 3n) => OnboardingGame.make(new GameDeck(couplets()), new Set(preferring), new SeededGenerator(seed))!;

  it("plays a short couplet of a poet the person picked", () => {
    for (let seed = 1n; seed <= 12n; seed++) {
      expect(make(["ferdousi"], seed).board.question.couplet.poetSlug).toBe("ferdousi");
      const any = make([], seed).board.question.words.length;
      expect(any >= 4 && any <= 6).toBe(true);
    }
  });

  it("has no game when there is no short couplet", () => {
    expect(OnboardingGame.make(new GameDeck([couplet(1, { m2: "یک دو" })]), new Set(), new SeededGenerator(1n))).toBeUndefined();
  });

  const solve = (game: OnboardingGame) => {
    const { question } = game.board;
    for (const position of question.missing) {
      const sticker = game.board.onSheet.find((one) => one.word === question.words[position])!;
      game.edit((board) => board.place(sticker, position));
    }
  };

  it("is won by sticking the right words", () => {
    const game = make();
    expect(game.leftCount).toBe(game.board.question.missing.length);
    game.check(); // nothing is placed yet
    expect(game.isOver).toBe(false);
    solve(game);
    expect(game.leftCount).toBe(0);
    game.check();
    expect(game.outcome).toBe("won");
    expect(onboardingReward).toBe(50);
  });

  it("shows a wrong sticker red, then takes it back and goes on", () => {
    const game = make();
    const { question } = game.board;
    const wrong = game.board.onSheet.find((sticker) => !question.missing.some((position) => question.words[position] === sticker.word))!;
    for (const position of question.missing) {
      const sticker = position === question.missing[0] ? wrong : game.board.onSheet.find((one) => one.word === question.words[position])!;
      game.edit((board) => board.place(sticker, position));
    }
    game.check();
    expect(game.outcome).toBeUndefined();
    expect(game.showsWrong).toBe(true);
    expect(game.misses).toBe(1);
    expect(game.board.mark(question.missing[0]!)).toBe("wrong"); // it stays, red, for a moment
    game.edit((board) => board.remove(question.missing[0]!));
    expect(game.board.word(question.missing[0]!)).toBe(wrong.word); // nothing changes while the red shows
    game.clearWrong();
    expect(game.showsWrong).toBe(false);
    expect(game.board.word(question.missing[0]!)).toBeUndefined(); // the wrong one went back to the sheet
    expect(game.leftCount).toBe(1);
  });

  it("is over after thirty seconds, and nothing changes after the end", () => {
    const game = make();
    for (let second = 0; second < 29; second++) game.tick();
    expect(game.outcome).toBeUndefined();
    game.tick();
    expect(game.outcome).toBe("timedOut");
    const before = [...game.board.onSheet];
    game.edit((board) => board.select(before[0]!));
    game.tick();
    expect(game.board.selected).toBeUndefined();
    expect(game.timeLeft).toBe(0);
  });

  it("reads its progress like the board", () => {
    const game = make();
    const { words, missing } = game.board.question;
    const names = ["صفر", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت"];
    expect(game.progressLine).toBe(`${names[words.length - missing.length]} تا درست، ${names[missing.length]} تا مونده!`);
  });
});
