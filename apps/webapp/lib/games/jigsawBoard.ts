import * as scoring from "./scoring";
import type { JigsawQuestion, JigsawSticker } from "./jigsawQuestion";
import type { SeededGenerator } from "./seeded";

/** What checking a couplet found. */
export type JigsawResult = {
  /** The words the player placed right (not counting the bulb's). */
  correctWords: number;
  hints: number;
  isRight: boolean;
  points: number;
};

/** How a slot reads once the couplet is checked: given from the start, the bulb's word, a right sticker or a wrong one. */
export type SlotMark = "given" | "hinted" | "right" | "wrong";

/** The couplet being played: which sticker sits in which slot, which one is in the hand, and what the bulb gave (Games/JigsawBoard.swift). */
export class JigsawBoard {
  /** Slot position → the sticker in it. */
  readonly placed = new Map<number, JigsawSticker>();
  /** The positions the bulb filled. They stay. */
  readonly hinted = new Set<number>();
  /** The sticker in the hand: tapped, waiting for a slot. */
  selected: JigsawSticker | undefined;
  /** The order of the sheet. */
  order: JigsawSticker[];

  constructor(readonly question: JigsawQuestion) {
    this.order = [...question.stickers];
  }

  /** The stickers still on the sheet, in its order. */
  get onSheet(): JigsawSticker[] {
    const used = new Set([...this.placed.values()].map((sticker) => sticker.id));
    return this.order.filter((sticker) => !used.has(sticker.id));
  }

  /** The word shown in a slot: the given word, or the placed sticker's; undefined for an empty slot. */
  word(position: number): string | undefined {
    return this.question.missing.includes(position) ? this.placed.get(position)?.word : this.question.words[position];
  }

  /** What the slot shows once the couplet is checked. Words count by their text, as `check` does. */
  mark(position: number): SlotMark {
    if (!this.question.missing.includes(position)) return "given";
    if (this.hinted.has(position)) return "hinted";
    return this.placed.get(position)?.word === this.question.words[position] ? "right" : "wrong";
  }

  get isFull(): boolean {
    return this.question.missing.every((position) => this.placed.has(position));
  }

  get canHint(): boolean {
    return this.hintPosition !== undefined;
  }

  /** Takes a sticker in hand; taking the one in hand puts it down. */
  select(sticker: JigsawSticker): void {
    this.selected = this.selected?.id === sticker.id ? undefined : sticker;
  }

  /** A tap on a slot: puts the sticker in hand there; with nothing in hand, takes the slot's sticker back to the sheet. */
  tapSlot(position: number): void {
    if (this.selected) this.place(this.selected, position);
    else this.remove(position);
  }

  /** Puts a sticker in a slot that waits for one (a slot the bulb filled stays). A sticker already there goes back to the sheet. */
  place(sticker: JigsawSticker, position: number): void {
    if (!this.question.missing.includes(position) || this.hinted.has(position)) return;
    this.unplace(sticker);
    this.placed.set(position, sticker);
    this.selected = undefined;
  }

  /** Takes a sticker back to the sheet. */
  remove(position: number): void {
    if (!this.hinted.has(position)) this.placed.delete(position);
  }

  /** Mixes the stickers on the sheet. */
  shuffle(generator: SeededGenerator): void {
    this.order = generator.shuffled(this.order);
  }

  /** The bulb: puts the right word in the first slot that is empty or wrong. */
  hint(): boolean {
    const position = this.hintPosition;
    if (position === undefined) return false;
    const word = this.question.words[position];
    // A sticker with that word that is not already the bulb's: one on the sheet, else one placed in a wrong slot.
    const holding = (sticker: JigsawSticker) => [...this.hinted].some((slot) => this.placed.get(slot)?.id === sticker.id);
    const candidates = this.question.stickers.filter((sticker) => sticker.word === word && !holding(sticker));
    const onSheet = new Set(this.onSheet.map((sticker) => sticker.id));
    const sticker = candidates.find((candidate) => onSheet.has(candidate.id)) ?? candidates[0];
    if (!sticker) return false;
    this.unplace(sticker);
    this.placed.set(position, sticker);
    this.hinted.add(position);
    this.selected = undefined;
    return true;
  }

  /** Looks at the placed stickers. Slots count by their word, so two stickers with the same word are the same. */
  check(): JigsawResult {
    const { missing, words } = this.question;
    const right = missing.filter((position) => this.placed.get(position)?.word === words[position]);
    const correctWords = right.filter((position) => !this.hinted.has(position)).length;
    return { correctWords, hints: this.hinted.size, isRight: right.length === missing.length, points: scoring.jigsaw(correctWords, this.hinted.size) };
  }

  private unplace(sticker: JigsawSticker): void {
    for (const [slot, other] of this.placed) if (other.id === sticker.id) this.placed.delete(slot);
  }

  private get hintPosition(): number | undefined {
    return this.question.missing.find((position) => !this.hinted.has(position) && this.placed.get(position)?.word !== this.question.words[position]);
  }
}

/** A word of the second hemistich as the player left it, for the answer sheet: what was placed and how it turned out. */
export type AttemptWord = { word: string; mark: SlotMark };

/** The words of a checked board, in reading order. */
export const attemptWords = (board: JigsawBoard): AttemptWord[] =>
  board.question.words.map((right, position) => ({ word: board.word(position) ?? right, mark: board.mark(position) }));

/** What a slot of a checked board looks like: the bulb's word keeps its look. */
export const statusOf = (mark: SlotMark): "correct" | "stuck" | "wrong" => (mark === "given" || mark === "right" ? "correct" : mark === "hinted" ? "stuck" : "wrong");
