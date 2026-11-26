import { readJSON, Store, writeJSON, type KeyValueStorage } from "../reader/store";

/** The moods of the taste step (OnbTaste), in board order. The key is what is stored. */
export const tasteMoods = [
  { key: "love", title: "عاشقانه" },
  { key: "hope", title: "امید" },
  { key: "longing", title: "دلتنگی" },
  { key: "mystic", title: "عرفانی" },
  { key: "humor", title: "طنز" },
  { key: "epic", title: "حماسی" },
  { key: "nature", title: "طبیعت" },
] as const;

export type TasteMood = (typeof tasteMoods)[number]["key"];

export const tastePoetsKey = "taste.poets";
export const tasteMoodsKey = "taste.moods";

type State = { poets: ReadonlySet<string>; moods: ReadonlySet<TasteMood> };

const strings = (storage: KeyValueStorage, key: string): string[] => {
  const saved = readJSON(storage, key);
  return Array.isArray(saved) ? saved.filter((value): value is string => typeof value === "string") : [];
};

/** The poets and moods the person picked in onboarding (Onboarding/Taste.swift). Kept in this browser only; «بیتِ امروز» prefers these poets. */
export class Taste extends Store<State> {
  constructor(private readonly storage: KeyValueStorage) {
    super({ poets: new Set(strings(storage, tastePoetsKey)), moods: new Set(strings(storage, tasteMoodsKey).filter((key): key is TasteMood => tasteMoods.some((mood) => mood.key === key))) });
  }

  get poets(): ReadonlySet<string> {
    return this.snapshot().poets;
  }

  get moods(): ReadonlySet<TasteMood> {
    return this.snapshot().moods;
  }

  togglePoet(slug: string): void {
    const poets = new Set(this.poets);
    if (!poets.delete(slug)) poets.add(slug);
    writeJSON(this.storage, tastePoetsKey, [...poets].sort());
    this.set({ ...this.snapshot(), poets });
  }

  toggleMood(mood: TasteMood): void {
    const moods = new Set(this.moods);
    if (!moods.delete(mood)) moods.add(mood);
    writeJSON(this.storage, tasteMoodsKey, [...moods].sort());
    this.set({ ...this.snapshot(), moods });
  }
}
