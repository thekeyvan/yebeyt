import { tabAt, tabs } from "../tabs";

/**
 * The screens that can be named in a report: a fixed list, so a name is never typed text (ScreenName in TechnicalInfo.swift). Bug reports send the name of the
 * screen and the names of the last screens visited (`FeedbackLog`).
 */
export const screenNames = [
  "خونه", "کاوش", "بازی", "پیام‌ها", "من", "کتابخونه", "کتاب", "بخش کتاب", "صفحه‌ی شاعر", "جست‌وجو", "موضوع", "همه‌ی شاعرها", "همه‌ی بازی‌ها", "دیوان", "حریم خصوصی", "چهره", "دعوت دوستان", "تنظیمات", "نشان‌ها", "مجوزها", "گفتگو", "دیوان مشترک", "پیدا کردن دوست", "صفحه‌ی یه آدم", "رده‌بندی", "دوستا", "درخواست‌های دوستی", "خوندن شعر", "معمای امروز", "جورچین بیت", "حدس شاعر", "مصراع دوم", "از کدوم کتاب؟", "معنی‌یاب", "گوش کن", "بازی با دوست", "مشاعره", "بازی رودررو", "چالش",
] as const;
export type ScreenName = (typeof screenNames)[number];

const pages: readonly (readonly [RegExp, ScreenName])[] = [
  [/^\/poem\//, "خوندن شعر"],
  [/^\/explore\/library$/, "کتابخونه"],
  [/^\/explore\/book\//, "کتاب"],
  [/^\/explore\/section\//, "بخش کتاب"],
  [/^\/explore\/poet\//, "صفحه‌ی شاعر"],
  [/^\/explore\/search$/, "جست‌وجو"],
  [/^\/explore\/mood\//, "موضوع"],
  [/^\/explore\/poets$/, "همه‌ی شاعرها"],
  [/^\/games\/catalog$/, "همه‌ی بازی‌ها"],
  [/^\/games\/leaderboard$/, "رده‌بندی"],
  [/^\/games\/daily$/, "معمای امروز"],
  [/^\/games\/jigsaw$/, "جورچین بیت"],
  [/^\/games\/poet$/, "حدس شاعر"],
  [/^\/games\/misra$/, "مصراع دوم"],
  [/^\/games\/book$/, "از کدوم کتاب؟"],
  [/^\/games\/match$/, "معنی‌یاب"],
  [/^\/games\/listen$/, "گوش کن"],
  [/^\/games\/lobby$/, "بازی با دوست"],
  [/^\/games\/mosh\//, "مشاعره"],
  [/^\/games\/duel\//, "بازی رودررو"],
  [/^\/c\//, "چالش"],
  [/^\/me\/divan$/, "دیوان"],
  [/^\/me\/privacy$/, "حریم خصوصی"],
  [/^\/me\/avatar$/, "چهره"],
  [/^\/me\/invite$/, "دعوت دوستان"],
  [/^\/me\/settings$/, "تنظیمات"],
  [/^\/me\/badges$/, "نشان‌ها"],
  [/^\/me\/licenses$/, "مجوزها"],
  [/^\/me\/friends$/, "دوستا"],
  [/^\/messages\/requests$/, "درخواست‌های دوستی"],
  [/^\/messages\/[^/]+\/divan$/, "دیوان مشترک"],
  [/^\/messages\/[^/]+$/, "گفتگو"],
  [/^\/people$/, "پیدا کردن دوست"],
  [/^\/u\//, "صفحه‌ی یه آدم"], // never the username
];

/** The name of the screen at an address; an address with no name of its own (the debug pages) is the tab it is under, or the home. */
export function screenAt(pathname: string): ScreenName {
  const page = pages.find(([pattern]) => pattern.test(pathname));
  if (page) return page[1];
  const tab = tabAt(pathname);
  return (tab === null ? "خونه" : tabs[tab]!.title) as ScreenName;
}
