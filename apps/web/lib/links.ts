import type { Avatar, Challenge, Person, PublicGame } from "./api";
import { APP_CLIP_BUNDLE_ID, APP_STORE_ID, SITE_URL, WEBAPP_URL } from "./config";
import { persianNumber } from "./persian";

/** Everything a link page shows, worked out from what the server said. */
export type LinkView = {
  name: string;
  avatar: Avatar | null;
  heading: string;
  description: string;
  after: string;
  codeLabel: string;
  code: string;
  url: string;
  /** Where the same thing opens in the web app (the invite: the person's page), when it does. */
  webUrl?: string;
};
export type ChallengeView = LinkView & { mine: string; yours: string };

const nameOf = (person: Person) => person.displayName ?? person.username;

/** «۱۰ بیت سعدی» (the server's label) as «۱۰ بیت از سعدی»; without a label just «۱۰ بیت». */
const thingsOf = (label: string | null, count: number) => {
  const match = label?.match(/^(.+? بیت) (.+)$/);
  return match ? `${match[1]} از ${match[2]}` : `${persianNumber(count)} بیت`;
};

export function challengeView(challenge: Challenge, code: string): ChallengeView {
  const name = nameOf(challenge.creator);
  const total = persianNumber(challenge.items.length);
  const things = thingsOf(challenge.label, challenge.items.length);
  return {
    name,
    avatar: challenge.creator.avatar,
    heading: `${name} تو رو به چالش کشیده!`,
    description:
      challenge.game === "jigsaw"
        ? `جورچین بیت با ${things}. کلمه‌های هر بیت ریخته؛ به ترتیب بچسبونشون.`
        : `حدس شاعر با ${things}. شاعر هر بیت رو از بین چهار چهره پیدا کن.`,
    after: "بعد از نصب، همین چالش خودش باز می‌شه.",
    mine: `${persianNumber(challenge.score)} از ${total}`,
    yours: `؟ از ${total}`,
    codeLabel: "کد چالش",
    code: code.toUpperCase(),
    url: `${SITE_URL}/c/${code}`,
  };
}

export function inviteView(person: Person): LinkView {
  const name = nameOf(person);
  return {
    name,
    avatar: person.avatar,
    heading: `${name} دعوتت کرده به یه بیت`,
    after: "بعد از نصب، همین دعوت خودش باز می‌شه.",
    description: "هر روز یه بیت برای تو، بازی با شعر، و مشاعره با دوستات.",
    codeLabel: "نام کاربری",
    code: person.username,
    url: `${SITE_URL}/i/${person.username}`,
    webUrl: `${WEBAPP_URL}/u/${encodeURIComponent(person.username)}`,
  };
}

const GAME_NAMES = { mosh: "مشاعره", duel: "بازی رودررو" } as const;
const GAME_DESCRIPTIONS = {
  mosh: "هر بار بیتی بگو که با آخرین حرف بیت قبلی شروع بشه.",
  duel: "پنج دور، هشت ثانیه برای هر دور؛ هر کی زودتر درست جواب بده، دور رو می‌بره.",
} as const;

export function gameView(game: PublicGame, code: string): LinkView {
  const name = nameOf(game.creator);
  return {
    name,
    avatar: game.creator.avatar,
    heading: `${name} دعوتت کرده به ${GAME_NAMES[game.kind]}`,
    description: GAME_DESCRIPTIONS[game.kind],
    after: "بعد از نصب، همین بازی خودش باز می‌شه.",
    codeLabel: "کد بازی",
    code: code.toUpperCase(),
    url: `${SITE_URL}/g/${code}`,
  };
}

/** The Smart App Banner and App Clip card tag for a page, or null until the app's App Store id is set (config.ts). */
export function smartBanner(url: string, appStoreId = APP_STORE_ID): string | null {
  return appStoreId ? `app-id=${appStoreId}, app-clip-bundle-id=${APP_CLIP_BUNDLE_ID}, app-argument=${url}` : null;
}
