/**
 * A small random generator that gives the same numbers for the same seed (Games/PersianLetters.swift `SeededGenerator`, splitmix64), so the
 * daily puzzle and its keyboard are the same for everyone, on every device, and tests can fix the rounds. 64-bit arithmetic is done in BigInt.
 */
const word = (value: bigint): bigint => BigInt.asUintN(64, value);

export class SeededGenerator {
  private state: bigint;

  constructor(seed: bigint) {
    this.state = word(seed);
  }

  /** A seed that is different every time. */
  static random(): SeededGenerator {
    return new SeededGenerator(crypto.getRandomValues(new BigUint64Array(1))[0]!);
  }

  next(): bigint {
    this.state = word(this.state + 0x9e3779b97f4a7c15n);
    let z = this.state;
    z = word((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n);
    z = word((z ^ (z >> 27n)) * 0x94d049bb133111ebn);
    return z ^ (z >> 31n);
  }

  /** A number from 0 up to, not including, `count`. */
  below(count: number): number {
    return Number(this.next() % BigInt(count));
  }

  /** A shuffle that never changes between releases (Fisher–Yates, with this generator). */
  shuffled<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
      const other = this.below(index + 1);
      [result[index], result[other]] = [result[other]!, result[index]!];
    }
    return result;
  }
}
