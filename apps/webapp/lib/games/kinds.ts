/** The nine games (Games/GameKind.swift). */
export type GameKind = "daily" | "jigsaw" | "poet" | "misra" | "book" | "match" | "listen" | "mosh" | "duel";

/** In the order of the catalog. */
export const allKinds: readonly GameKind[] = ["daily", "jigsaw", "poet", "misra", "book", "match", "listen", "mosh", "duel"];

type Info = {
  name: string;
  /** The line under the name in the catalog. */
  meta: string;
  /** The rule of the game: the catalog card's description for screen readers. */
  about: string;
  /** The sticker's background: one colour, or two split on the diagonal (games with friends). */
  background: readonly [string, string?];
  /** The line on the card of the games tab, for the games drawn there. */
  tagline?: string;
};

const color = (name: string) => `var(--color-${name})`;

const info: Record<GameKind, Info> = {
  daily: {
    name: "معمای امروز",
    meta: "روزانه · ۱ دقیقه · رشته‌ی روزها",
    about: "یه بیت با یه کلمه‌ی جا افتاده؛ حرف‌هاش رو از برچسب‌های پایین بچین، تایپ لازم نیست. ۳ فرصت، برای همه یکی، فردا عوض می‌شه.",
    background: [color("lapis")],
  },
  jigsaw: {
    name: "جورچین بیت",
    meta: "تکی · ۱۰ بیت · ۲ دقیقه",
    about: "کلمه‌های یه بیت ریخته؛ برچسب‌ها رو بکن و به ترتیب بچسبون.",
    background: [color("fire")],
    tagline: "کلمه‌ها رو بچین",
  },
  poet: {
    name: "حدس شاعر",
    meta: "تکی · ۱۰ سؤال · زمان‌دار",
    about: "یه بیت می‌بینی؛ از بین چهار شاعر (چهره و اسم) شاعرش رو انتخاب کن.",
    background: [color("amber")],
    tagline: "کی گفته؟ ۴ گزینه",
  },
  misra: {
    name: "مصراع دوم",
    meta: "تکی · ۱۰ سؤال · ۲ دقیقه",
    about: "مصراع اول رو داری؛ مصراع دومِ درست رو از بین سه تا پیدا کن.",
    background: [color("green")],
    tagline: "مصراع دوم رو پیدا کن",
  },
  book: {
    name: "از کدوم کتاب؟",
    meta: "تکی · ۱۰ سؤال",
    about: "شاعر رو بهت می‌گیم؛ تو بگو این بیت از کدوم کتابِ اونه. مثلاً مولانا: مثنوی، دیوان شمس یا فیه ما فیه؟",
    background: [color("magenta")],
    tagline: "کدوم کتابِ شاعره؟",
  },
  match: {
    name: "معنی‌یاب",
    meta: "تکی · ۵ جفت · بی‌عجله",
    about: "واژه‌های سخت یه بیت رو به معنی‌شون وصل کن؛ همون واژه‌های نقطه‌چین.",
    background: ["#1C20B8"],
  },
  listen: {
    name: "گوش کن",
    meta: "تکی · ۵ سؤال · با هدفون",
    about: "مصراع اول با صدا پخش می‌شه و متنش رو نمی‌بینی؛ مصراع دومش رو از بین نوشته‌ها پیدا کن. سطح بالاتر: شاعرش رو بگو.",
    background: [color("ink")],
  },
  mosh: {
    name: "مشاعره",
    meta: "با دوست · تا وقتی کسی کم بیاره",
    about: "بیتت باید با حرف آخرِ بیتِ اون یکی شروع بشه. نوبتی، با زمان برای هر نوبت.",
    background: [color("amber"), color("lapis")],
  },
  duel: {
    name: "بازی رودررو",
    meta: "با دوست · ۵ دور · ۳ دقیقه",
    about: "۵ دور سریع از بازی‌های بالا، هم‌زمان با یه دوست. هر کی بیشتر برد.",
    background: [color("fire"), color("magenta")],
  },
};

export const nameOf = (kind: GameKind): string => info[kind].name;
export const metaOf = (kind: GameKind): string => info[kind].meta;
export const aboutOf = (kind: GameKind): string => info[kind].about;
export const taglineOf = (kind: GameKind): string | undefined => info[kind].tagline;
export const backgroundOf = (kind: GameKind): readonly [string, string?] => info[kind].background;

/** The games with a card on the games tab, in the order of the board. */
export const tabCards: readonly GameKind[] = ["jigsaw", "poet", "misra", "book"];

/** The games that are on the web: all the solo ones, each with a page of its own at `/games/<kind>` (the names are `GameKind`'s). */
export const playableKinds = ["daily", "jigsaw", "poet", "misra", "book", "match", "listen"] as const;
export type PlayableKind = (typeof playableKinds)[number];

export const isPlayable = (kind: string): kind is PlayableKind => (playableKinds as readonly string[]).includes(kind);

const pageOf = (kind: PlayableKind): string => `/games/${kind}`;

/** The games with a friend and the board of a challenge have pages of their own: «بازی با دوست» (`/games/lobby`), a game by its id (`/games/mosh/<id>`, `/games/duel/<id>`) and a challenge by its code (`/c/<code>`). */
const friendPage = /^\/(?:games\/lobby|games\/(?:mosh|duel)\/[A-Za-z0-9_-]+|c\/[0-9A-Za-z]{4})$/;

/** Whether the path is a game's page: it covers the tabs, as the reader does. */
export const isGamePage = (pathname: string): boolean => playableKinds.some((kind) => pageOf(kind) === pathname) || friendPage.test(pathname);

/** مصراع دوم with the couplets of one poet only (from the poet's page): `/games/misra?poet=hafez`. */
export const poetGameURL = (slug: string): string => `${pageOf("misra")}?${new URLSearchParams({ poet: slug })}`;

/** The poet an address asks for; anything that is not a slug (letters, digits, «_» and «-») is none. */
export function parsePoet(value: string | string[] | undefined): string | undefined {
  const slug = Array.isArray(value) ? value[0] : value;
  return slug !== undefined && /^[A-Za-z0-9_-]+$/.test(slug) ? slug : undefined;
}

/** What a tap on the game does: opens its page, or (the games with a friend, which need the server) asks for an account and then opens «بازی با دوست» with that game chosen (`GameKind.route`). */
export function opening(kind: GameKind): { page: string } | { lobby: "mosh" | "duel" } {
  return isPlayable(kind) ? { page: pageOf(kind) } : { lobby: kind as "mosh" | "duel" };
}
