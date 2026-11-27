import { expect, type Page } from "@playwright/test";
import { openApp } from "./browse";
import { answerCouplet } from "./games";

/** Sara's answer in `g1` as the server tells it live: her couplet (it ends with «ا») and the turn coming back to me. */
export const saraMove = (n: number) => ({
  type: "game.move",
  gameId: "g1",
  move: { n, username: "sara.ghazal", key: "/hafez/ghazal/sh7#0", m1: "دلا نزد کسی بنشین که او از دل خبر دارد", m2: "به زیر کلک نکته‌ها", createdAt: new Date().toISOString() },
  scores: [{ username: "niloofar", score: 5 }, { username: "sara.ghazal", score: 4 }],
});

export const turnOfMine = { type: "game.turn", gameId: "g1", username: "niloofar", deadline: new Date(Date.now() + 21 * 3_600_000).toISOString() };

const scores = (mine: number, sara: number) => [{ username: "niloofar", score: mine }, { username: "sara.ghazal", score: sara }];

/** A question of the duel `d1`, as `duel.question` brings it (`deadlineMs` is the time left in the round). */
export const duelQuestion = (round: number, extra: object = {}) => ({
  type: "duel.question",
  gameId: "d1",
  round,
  rounds: 5,
  kind: "second",
  couplet: { m1: "توانا بود هر که دانا بود" },
  poet: "فردوسی",
  options: ["ز دانش دل پیر برنا بود", "به دانش دل مرد بینا بود", "ز گفتار او جان شکیبا بود"],
  deadlineMs: 8000,
  ...extra,
});

export const duelRound = (round: number, winner: string | null, right: number, mine: number, sara: number) => ({ type: "duel.round", gameId: "d1", round, winner, rightOption: right, scores: scores(mine, sara) });

/** The first three rounds of `d1` are over (I won the first and the third), round four is asked and Sara has answered it wrong already: the state of the phone's `-beytRoute duel`. */
export async function playToRoundFour(live: { push(event: object): Promise<void> }) {
  await live.push(duelRound(1, "niloofar", 0, 1, 0));
  await live.push(duelRound(2, "sara.ghazal", 1, 1, 1));
  await live.push(duelRound(3, "niloofar", 2, 2, 1));
  await live.push(duelQuestion(4));
  await live.push({ type: "duel.answered", gameId: "d1", round: 4, username: "sara.ghazal" });
}

/** The end of `d1` as the server tells it: five couplets with their meanings and who won each. */
export const duelEnded = {
  type: "game.ended",
  gameId: "d1",
  winner: "niloofar",
  reason: "finished",
  scores: scores(4, 1),
  couplets: [
    ["/hafez/ghazal/sh3#0", "hafez", "niloofar"],
    ["/saadi/divan/ghazals/sh2#0", "saadi", "sara.ghazal"],
    ["/hafez/ghazal/sh8#4", "hafez", "niloofar"],
    ["/ferdousi/shahname/sh1#0", "ferdousi", "niloofar"],
    ["/saadi/divan/ghazals/sh24#1", "saadi", null],
  ].map(([key, poet, winner], index) => ({ round: index + 1, type: "second", key, m1: "توانا بود هر که دانا بود", m2: "ز دانش دل پیر برنا بود", meaning: "هر که دانا باشد، توانا هم هست.", poet, bookTitle: "شاهنامه", winner })),
};

/** Plays the ten couplets of a جورچین round right, tapping each one's stickers; ends on the end-of-round screen. */
export async function playRound(page: Page) {
  for (let index = 0; index < 10; index++) {
    await answerCouplet(page, "right");
    await page.getByTestId("next").click();
  }
  await expect(page.getByTestId("round-end")).toBeVisible();
}

/** Opens a page as a guest with the web app's door answering games and challenges itself (`sessionStorage.beytPlayStub`, the phone's `-beytPlayStub 1`), and the جورچین round fixed. */
export async function openAsGuest(page: Page, path: string) {
  await page.addInitScript(() => {
    sessionStorage.setItem("beytPlayStub", "1");
    sessionStorage.setItem("beytSeed", "1");
  });
  await openApp(page, path, { api: true });
}
