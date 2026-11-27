import { ApiError } from "../account/api";
import { persianClock, persianDigits } from "../persian";
import type { ChallengeLiveResult } from "./models";

/** How a finished game of مشاعره ended for me. */
export type Outcome = "won" | "lost" | "draw";

/** The words of the games with friends, kept in one place: the boards' copy and the lead's copy where a board has none (Play/PlayCopy.swift). */
export const playCopy = {
  // Turn time

  /** The lobby's choices and the line in a game: «۳۰ ثانیه», «۲ دقیقه», «تا فردا». */
  turnTime: (seconds: number): string => (seconds === 86_400 ? "تا فردا" : seconds === 120 ? "۲ دقیقه" : `${persianDigits(seconds)} ثانیه`),

  /** The time left: «۲۱ ساعت» (a game with a day to answer, while there is an hour or more, then «۴۵ دقیقه»), else «۰:۲۵». */
  timeLeft(seconds: number, turnSeconds: number): string {
    if (turnSeconds < 3600 || seconds < 60) return persianClock(seconds);
    return seconds >= 3600 ? `${persianDigits(Math.floor(seconds / 3600))} ساعت` : `${persianDigits(Math.floor((seconds + 59) / 60))} دقیقه`;
  },

  // مشاعره

  /** «نوبت توئه، با حرف «د»» */
  myTurn: (letter: string): string => `نوبت توئه، با حرف «${letter}»`,
  myTurnFirst: "نوبت توئه؛ بیت اول رو بگو",
  waiting: (name: string): string => (name === "" ? "منتظر دوستت…" : `منتظر ${name}…`),
  notFound: "این بیت رو پیدا نکردیم",

  /** «بردی!», «سارا برد», «مساوی» */
  title: (outcome: Outcome, other: string): string => (outcome === "won" ? "بردی!" : outcome === "lost" ? `${other} برد` : "مساوی"),

  /** «با حرف «د» شروع نمی‌شه» */
  wrongLetter: (letter?: string): string => (letter ? `با حرف «${letter}» شروع نمی‌شه` : "با این حرف شروع نمی‌شه"),
  alreadyPlayed: "این بیت رو قبلاً گفتید",

  /** What a refused move says. The letter is the one the couplet had to start with. */
  moveError(error: unknown, letter?: string): string {
    if (!(error instanceof ApiError)) return new ApiError(0).persianMessage;
    switch (error.code) {
      case "wrong_letter":
        return playCopy.wrongLetter(letter);
      case "already_played":
        return playCopy.alreadyPlayed;
      case "turn_over":
        return "وقتت تموم شد";
      case "bad_couplet":
        return "این بیت با متن گنجور نمی‌خونه";
      case "not_your_turn":
        return "نوبت تو نیست";
      case "game_not_active":
        return "این بازی تموم شده";
      default:
        return error.persianMessage;
    }
  },

  /** What joining or making a game says when it fails. */
  gameError(error: unknown): string {
    if (!(error instanceof ApiError)) return new ApiError(0).persianMessage;
    switch (error.code) {
      case "game_full":
        return "یکی دیگه زودتر اومده توی این بازی";
      case "not_found":
        return "این بازی پیدا نشد";
      case "forbidden":
      case "username_required":
        return "برای بازی با دوستات یه نام کاربری لازمه";
      default:
        return error.persianMessage;
    }
  },

  // Lobby

  /** «بیا مشاعره کنیم · https://yebeyt.com/g/M4R9»: what the link of a game is sent with. */
  gameShare: (game: string, url: string): string => `بیا ${game} کنیم · ${url}`,
  lobbyFooter: "هر کی اول اومد، بازی شروع می‌شه. تو هم اول می‌تونی بیت اول رو بگی.",
  lobbyDuelFooter: "هر کی اول اومد، بازی شروع می‌شه.",
  lobbyChallengeFooter: "اول خودت ۱۰ بیت رو بازی می‌کنی، بعد چالش برای دوستات می‌ره.",

  /** Why somebody did not get the invitation: they take game invitations only from friends, or are not there. */
  skipped(person: { username: string; reason: string }): string | undefined {
    if (person.reason === "friends_only") return `${person.username} فقط از دوستاش دعوت به بازی می‌گیره`;
    if (person.reason === "not_found") return `${person.username} رو پیدا نکردیم`;
    return undefined;
  },
  tooManyInvites: "حداکثر ۵ نفر رو می‌شه دعوت کرد",

  // Chat

  /** «سارا دعوتت کرد به مشاعره» */
  invite: (name: string, game: string): string => `${name} دعوتت کرد به ${game}`,
  invited: (game: string): string => `دعوتش کردی به ${game}`,

  /** «سارا توی چالشت ۷ از ۱۰ گرفت» */
  challengeResult: (name: string, score: number): string => `${name} توی چالشت ${persianDigits(score)} از ۱۰ گرفت`,
  challengeResultMine: (name: string, score: number): string => `توی چالش ${name} ${persianDigits(score)} از ۱۰ گرفتی`,
  /** The toast of a guest's result on my challenge. */
  liveResult: (result: Pick<ChallengeLiveResult, "name" | "score">): string => playCopy.challengeResult(result.name, result.score),

  // Challenges

  /** «نیلوفر تو رو به جورچین بیت چالش کشید · yebeyt.com/c/7KQ2»: the chat message to a friend. */
  challengeInvite: (name: string, game: string, code: string): string => `${name} تو رو به ${game} چالش کشید · ${playCopy.challengeLink(code)}`,

  /** «نیلوفر توی جورچین بیت ۸ از ۱۰ گرفت. تو چند می‌گیری؟» */
  challengeBrag: (name: string, game: string, score: number): string => `${name} توی ${game} ${persianDigits(score)} از ۱۰ گرفت. تو چند می‌گیری؟`,

  /** The board of a challenge opened from a link (ChallengeAccept). */
  fromLink: (name: string): string => `از لینک ${name}`,
  waitingForYou: (name: string): string => `${name} منتظرته`,
  sameTen: "همون ۱۰ بیتی که اون بازی کرد.",
  toWin: (score: number): string => `بیشتر از ${persianDigits(score)} تا بگیری، تو بردی.`,
  aboutTwoMinutes: "حدود ۲ دقیقه",
  noAccount: "حساب نمی‌خواد",
  noAccountNote: (name: string): string => `بازی کن؛ آخرش فقط یه اسم بنویس تا ${name} نتیجه‌ت رو ببینه. اگه خوشت اومد، می‌تونی بعداً حساب بسازی و با هم مشاعره کنید.`,
  outOfTen: (score: number): string => `${persianDigits(score)} از ۱۰`,
  namePrompt: "اسمت چیه؟",
  nameNeeded: "یه اسم بنویس",
  challengePending: "چالش هنوز آماده نیست؛ یه لحظه صبر کن",
  challengeSentTo: (name: string): string => `برای ${name} فرستاده شد`,
  challengeNotOpened: "این چالش باز نشد",
  challengeGone: "این چالش پیدا نشد یا تموم شده",
  /** «تو ۷ · نیلوفر ۸» */
  scores: (mine: number, name: string, theirs: number): string => `تو ${persianDigits(mine)} · ${name} ${persianDigits(theirs)}`,

  challengeLink: (code: string): string => `yebeyt.com/c/${code}`,
  gameLink: (code: string): string => `yebeyt.com/g/${code}`,

  // رودررو

  answerNotSent: "جوابت نرسید؛ دوباره بزن",
  duelWaiting: (name: string): string => `منتظر ${name}…`,
  duelLeft: (name: string): string => `${name} رفت`,
  duelRound: (winner: string | null, me: string, otherName: string): string => (winner === null ? "این دور کسی نبرد" : winner === me ? "این دور رو بردی" : `${otherName} این دور رو برد`),
} as const;
