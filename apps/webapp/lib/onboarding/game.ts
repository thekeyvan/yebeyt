import { JigsawBoard } from "../games/jigsawBoard";
import type { GameCouplet, GameDeck } from "../games/couplet";
import { coupletId } from "../games/couplet";
import { canPlay, makeQuestion } from "../games/jigsawQuestion";
import { wordsOf } from "../games/letters";
import type { SeededGenerator } from "../games/seeded";
import { persianDigits } from "../persian";
import { Store } from "../reader/store";

export const onboardingDuration = 30;
export const onboardingReward = 50;

/** A short second hemistich keeps the couplet at two or three missing words. */
const wordRange = { min: 4, max: 6 };
const distractorSample = 40;

const countWords = ["صفر", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه", "ده"];
const countWord = (count: number): string => countWords[count] ?? persianDigits(count);

export type OnboardingOutcome = "won" | "timedOut";

/**
 * OnbGame: one couplet of جورچین بیت and 30 seconds (Onboarding/OnboardingGame.swift). It reuses the game's board and question; the clock and the reward
 * are its own. Winning is worth +۵۰ points (the account step shows it). The state is a counter that grows with every change.
 */
export class OnboardingGame extends Store<number> {
  timeLeft = onboardingDuration;
  outcome?: OnboardingOutcome;
  /** A wrong try is on the card, its wrong stickers red, until `clearWrong` takes them back. */
  showsWrong = false;
  /** The wrong tries so far. */
  misses = 0;

  private constructor(readonly board: JigsawBoard) {
    super(0);
  }

  /** A game with a short couplet from the deck, of a poet the person picked when there is one; undefined when the deck has none. */
  static make(deck: GameDeck, preferring: ReadonlySet<string>, generator: SeededGenerator): OnboardingGame | undefined {
    const short = deck.couplets.filter((one) => canPlay(one) && wordsOf(one.m2).length >= wordRange.min && wordsOf(one.m2).length <= wordRange.max);
    const liked = short.filter((one) => preferring.has(one.poetSlug));
    const chosen: GameCouplet | undefined = generator.shuffled(liked.length === 0 ? short : liked)[0];
    if (!chosen) return undefined;
    const others = generator.shuffled(deck.couplets.filter((one) => coupletId(one) !== coupletId(chosen)).slice(0, distractorSample).flatMap((one) => wordsOf(one.m2)));
    const question = makeQuestion(chosen, others, generator);
    return question && new OnboardingGame(new JigsawBoard(question));
  }

  get isOver(): boolean {
    return this.outcome !== undefined;
  }

  /** Words in the right place so far (the given ones count), and those still to come: «سه تا درست، دو تا مونده!». */
  get rightCount(): number {
    const { words } = this.board.question;
    return words.filter((word, position) => this.board.word(position) === word).length;
  }

  get leftCount(): number {
    return this.board.question.words.length - this.rightCount;
  }

  /** «سه تا درست، دو تا مونده!» */
  get progressLine(): string {
    return `${countWord(this.rightCount)} تا درست، ${countWord(this.leftCount)} تا مونده!`;
  }

  edit(change: (board: JigsawBoard) => void): void {
    if (this.isOver || this.showsWrong) return;
    change(this.board);
    this.changed();
  }

  /** One second passes; at zero the game is over. */
  tick(): void {
    if (this.isOver) return;
    this.timeLeft -= 1;
    if (this.timeLeft <= 0) this.outcome = "timedOut";
    this.changed();
  }

  /** «بچسبون!»: right ends the game; wrong shows the wrong stickers red (`showsWrong`), and `clearWrong` then takes them back to the sheet so the person can try again. */
  check(): void {
    if (this.isOver || this.showsWrong || !this.board.isFull) return;
    if (this.board.check().isRight) this.outcome = "won";
    else {
      this.misses += 1;
      this.showsWrong = true;
    }
    this.changed();
  }

  /** Takes the red stickers back to the sheet. */
  clearWrong(): void {
    if (!this.showsWrong) return;
    for (const position of this.board.question.missing) if (this.board.mark(position) === "wrong") this.board.remove(position);
    this.showsWrong = false;
    this.changed();
  }

  private changed(): void {
    this.set(this.snapshot() + 1);
  }
}
