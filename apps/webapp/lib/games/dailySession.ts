import { Store } from "../reader/store";
import { DailyGame } from "./dailyGame";
import type { DailyPuzzle } from "./dailyPuzzle";
import type { GameStats } from "./stats";
import type { TehranDay } from "./tehranDay";

/** معمای امروز being played: the puzzle of the day, the game, and what it does to the browser's stats. Every try and hint is kept at once, so leaving and coming back finds the same state. */
export class DailySession extends Store<number> {
  readonly game: DailyGame;

  constructor(
    readonly puzzle: DailyPuzzle,
    readonly day: TehranDay,
    private readonly stats: GameStats,
  ) {
    super(0);
    this.game = new DailyGame(puzzle.letters, stats.daily(day));
  }

  get isOver(): boolean {
    return this.game.outcome !== "playing";
  }

  type(letter: string): void {
    this.game.type(letter);
    this.changed();
  }

  erase(): void {
    this.game.erase();
    this.changed();
  }

  submit(): void {
    if (this.game.submit()) this.stats.record(this.game.record, this.day);
    this.changed();
  }

  hint(): void {
    if (this.game.hint()) this.stats.record(this.game.record, this.day);
    this.changed();
  }

  private changed(): void {
    this.set(this.snapshot() + 1);
  }
}
