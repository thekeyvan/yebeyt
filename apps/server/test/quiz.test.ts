import { describe, expect, it } from "vitest";
import { loadGameData } from "../src/gameData.js";
import { makeQuestions, ROUNDS, seededGenerator } from "../src/quiz.js";
import { normalizeText, plain } from "../src/persian.js";

const data = loadGameData();
const poetName = (slug: string) => data.poets.find((p) => p.slug === slug)?.name;

describe("seededGenerator", () => {
  it("gives the numbers and the shuffle of the phone's SeededGenerator (checked against a Swift run)", () => {
    const g = seededGenerator(42n);
    expect([g.next(), g.next(), g.next()]).toEqual([13679457532755275413n, 2949826092126892291n, 5139283748462763858n]);
    expect(seededGenerator(7n).shuffled([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual([8, 1, 5, 9, 0, 4, 3, 2, 6, 7]);
  });
});

describe("makeQuestions", () => {
  const seeds = Array.from({ length: 40 }, (_, i) => BigInt(i + 1));

  it("is the same for the same seed and different for another", () => {
    const a = makeQuestions(data, seededGenerator(5n));
    expect(makeQuestions(data, seededGenerator(5n))).toEqual(a);
    expect(makeQuestions(data, seededGenerator(6n))).not.toEqual(a);
  });

  it("makes five questions of five different couplets", () => {
    for (const seed of seeds) {
      const questions = makeQuestions(data, seededGenerator(seed));
      expect(questions).toHaveLength(ROUNDS);
      expect(new Set(questions.map((q) => q.couplet.key)).size).toBe(ROUNDS);
    }
  });

  it("has the right option at `correct` and no repeated option, for every type", () => {
    const seen = new Set<string>();
    for (const seed of seeds) {
      for (const q of makeQuestions(data, seededGenerator(seed))) {
        seen.add(q.type);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        if (q.type === "second") {
          expect(q.options).toHaveLength(3);
          expect(q.options[q.correct]).toBe(plain(q.couplet.m2));
          // the other two are the same poet's other hemistichs
          const others = q.options.filter((_, i) => i !== q.correct).map(normalizeText);
          for (const text of others) expect(data.deck.some((c) => c.poet === q.couplet.poet && normalizeText(c.m2) === text && c.key !== q.couplet.key)).toBe(true);
        } else if (q.type === "poet") {
          expect(q.options).toHaveLength(4);
          expect(q.options[q.correct]).toBe(poetName(q.couplet.poet));
        } else {
          expect(q.options.length).toBeGreaterThanOrEqual(2);
          expect(q.options.length).toBeLessThanOrEqual(3);
          expect(q.options[q.correct]).toBe(data.books.find((b) => b.path === q.couplet.book)!.title);
          for (const title of q.options) expect(data.books.some((b) => b.poet === q.couplet.poet && b.title === title)).toBe(true);
        }
      }
    }
    expect([...seen].sort()).toEqual(["book", "poet", "second"]);
  });

  it("takes the poet distractors from the same century first", () => {
    let checked = 0;
    for (const seed of seeds) {
      for (const q of makeQuestions(data, seededGenerator(seed)).filter((q) => q.type === "poet")) {
        const own = data.poets.find((p) => p.slug === q.couplet.poet)!;
        const sameCentury = data.poets.filter((p) => p.slug !== own.slug && p.name !== own.name && own.century !== undefined && p.century === own.century);
        const wrong = q.options.filter((_, i) => i !== q.correct);
        if (sameCentury.length >= 3) {
          for (const name of wrong) expect(sameCentury.some((p) => p.name === name)).toBe(true);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
