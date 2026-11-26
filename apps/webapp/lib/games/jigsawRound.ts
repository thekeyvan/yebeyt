import { JigsawBoard, type JigsawResult } from "./jigsawBoard";
import { canPlay, makeQuestion, type JigsawQuestion } from "./jigsawQuestion";
import { coupletId, singlePoet, type GameCouplet, type GameDeck } from "./couplet";
import { wordsOf } from "./letters";
import * as scoring from "./scoring";
import type { SeededGenerator } from "./seeded";

export const questionCount = 10;
export const duration = 120;
/** «سه تا پشت سر هم درست!» shows after this many right couplets in a row. */
export const comboLength = 3;
/** The words other couplets lend as the extra stickers. */
const distractorSample = 40;

/** What one couplet's answer earned and how long it took. */
export type JigsawAnswer = { result: JigsawResult; seconds: number };

/** A round of جورچین بیت: ten couplets and two minutes for all of them. The clock runs only while a couplet is being played, not while the sheet with its meaning is open (Games/JigsawRound.swift). */
export class JigsawRound {
  index = 0;
  board: JigsawBoard;
  /** One answer per couplet played. */
  readonly answers: JigsawAnswer[] = [];
  timeLeft = duration;
  /** The seconds spent on the couplet in front of the player. */
  secondsOnCurrent = 0;

  constructor(readonly questions: readonly JigsawQuestion[]) {
    this.board = new JigsawBoard(questions[0]!);
  }

  /** A round: the opening couplets that can be played, then deck couplets, ten in all; undefined when nothing can be played. */
  static make(opening: readonly GameCouplet[], deck: GameDeck, generator: SeededGenerator): JigsawRound | undefined {
    const chosen = opening.filter(canPlay).slice(0, questionCount);
    const taken = new Set(chosen.map(coupletId));
    const fill = generator.shuffled(deck.couplets.filter((couplet) => !taken.has(coupletId(couplet))));
    chosen.push(...fill.slice(0, questionCount - chosen.length));
    const pool = generator.shuffled(fill.slice(0, distractorSample).flatMap((couplet) => wordsOf(couplet.m2)));
    const questions = chosen.flatMap((couplet) => makeQuestion(couplet, generator.shuffled(pool), generator) ?? []);
    return questions.length === 0 ? undefined : new JigsawRound(questions);
  }

  /** The points of the couplets so far. */
  get points(): number {
    return this.answers.reduce((sum, answer) => sum + answer.result.points, 0);
  }

  /** Every couplet was answered, so the seconds left count for points. */
  get isFinished(): boolean {
    return this.answers.length === this.questions.length;
  }

  /** The round is over: all couplets are answered, or the time ran out. */
  get isOver(): boolean {
    return this.isFinished || this.timeLeft === 0;
  }

  get timeBonus(): number {
    return this.isFinished ? scoring.jigsawTimeBonus(this.timeLeft) : 0;
  }

  get totalPoints(): number {
    return this.points + this.timeBonus;
  }

  get elapsed(): number {
    return duration - this.timeLeft;
  }

  get rightCount(): number {
    return this.answers.filter((answer) => answer.result.isRight).length;
  }

  /** The right couplets in a row, up to the last one answered. */
  get combo(): number {
    let count = 0;
    for (const answer of [...this.answers].reverse()) {
      if (!answer.result.isRight) break;
      count++;
    }
    return count;
  }

  /** The answer whose sheet is open: the couplet is answered but the player has not moved on. */
  get sheetOpen(): boolean {
    return this.answers.length > this.index;
  }

  get lastAnswer(): JigsawAnswer | undefined {
    return this.sheetOpen ? this.answers[this.index] : undefined;
  }

  /** The couplet in front of the player, or the one just answered while its sheet is open. */
  get current(): JigsawQuestion {
    return this.questions[this.index]!;
  }

  /** One second passes. It only counts while a couplet is being played. */
  tick(): void {
    if (this.isOver || this.sheetOpen) return;
    this.timeLeft--;
    this.secondsOnCurrent++;
  }

  /** Changes the couplet in play: taking stickers, placing, the bulb. */
  edit(change: (board: JigsawBoard) => void): void {
    if (!this.isOver && !this.sheetOpen) change(this.board);
  }

  /** «بچسبون!»: checks the couplet. Nothing happens until every slot is filled. */
  check(): JigsawAnswer | undefined {
    if (this.isOver || this.sheetOpen || !this.board.isFull) return undefined;
    const answer = { result: this.board.check(), seconds: this.secondsOnCurrent };
    this.answers.push(answer);
    return answer;
  }

  /** «بیت بعدی»: the next couplet. After the last one the round is finished. */
  next(): void {
    if (!this.sheetOpen || this.isFinished) return;
    this.index++;
    this.board = new JigsawBoard(this.questions[this.index]!);
    this.secondsOnCurrent = 0;
  }

  /** «۱۰ بیت سعدی»: the poet's name when every couplet is by the same poet. */
  get singlePoet(): string | undefined {
    return singlePoet(this.questions.map((question) => question.couplet));
  }
}
