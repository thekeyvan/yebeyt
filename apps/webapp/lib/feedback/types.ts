/** The first `limit` UTF-16 units (what the server counts), never ending in half of a pair. */
export function clip(text: string, limit: number): string {
  const cut = text.slice(0, limit);
  return text.length > limit && /[\ud800-\udbff]$/.test(cut) ? cut.slice(0, -1) : cut;
}

/** The five kinds of feedback (FeedbackType.swift). The value is the `type` of `POST /v1/feedback`. */
export type FeedbackType = "bug" | "annoyed" | "idea" | "game" | "liked";

/** The order of the rows on the board's sheet. */
export const menuOrder: readonly FeedbackType[] = ["bug", "idea", "game", "liked", "annoyed"];

type Kind = { title: string; subtitle: string; isNew?: boolean; screenshotDefault?: boolean };

/** `screenshotDefault`: the docs table says a bug and an annoyance take a screenshot (switch on), an idea may (switch off), the rest never. */
const kinds: Record<FeedbackType, Kind> = {
  bug: { title: "باگ دیدم", subtitle: "یه چیزی درست کار نمی‌کنه", screenshotDefault: true },
  annoyed: { title: "یه جاش اذیتم کرد", subtitle: "انتقادت رو بی‌تعارف بگو", screenshotDefault: true },
  idea: { title: "یه ایده دارم", subtitle: "چیزی که اپ رو بهتر کنه", screenshotDefault: false },
  game: { title: "یه بازی پیشنهاد بدم", subtitle: "بازی‌ای که دلت می‌خواد توی «یه بیت» باشه", isNew: true },
  liked: { title: "خوشم اومد", subtitle: "بگو چی رو دوست داشتی" },
};

export const titleOf = (type: FeedbackType): string => kinds[type].title;
export const subtitleOf = (type: FeedbackType): string => kinds[type].subtitle;
export const isNew = (type: FeedbackType): boolean => kinds[type].isNew === true;
export const screenshotDefault = (type: FeedbackType): boolean | undefined => kinds[type].screenshotDefault;
export const takesScreenshot = (type: FeedbackType): boolean => screenshotDefault(type) !== undefined;
export const sendsScreen = (type: FeedbackType): boolean => type === "bug" || type === "annoyed";
export const sendsTechnical = (type: FeedbackType): boolean => type === "bug";
export const takesRecording = (type: FeedbackType): boolean => type === "bug";

/** «چند بار پیش اومده؟» */
export const frequencies = [
  { value: "always", label: "همیشه" },
  { value: "sometimes", label: "گاهی" },
  { value: "once", label: "یه بار" },
] as const;
export type Frequency = (typeof frequencies)[number]["value"];

/** «با کی بازی می‌شه؟» */
export const playerChoices = [
  { value: "solo", label: "تنها" },
  { value: "friends", label: "با دوست" },
  { value: "both", label: "هر دو" },
] as const;
export type Players = (typeof playerChoices)[number]["value"];

export const textLimit = 2000;
export const nameLimit = 60;

/** What the person has filled in. `text` is the main field: «چی شد؟» for a bug, «چطوری بازی می‌شه؟» for a game idea. */
export type Draft = { type: FeedbackType; text: string; frequency: Frequency; gameName: string; players: Players; screenshotOn: boolean };

export const newDraft = (type: FeedbackType): Draft => ({ type, text: "", frequency: "sometimes", gameName: "", players: "solo", screenshotOn: screenshotDefault(type) ?? false });

export const trimmedText = (draft: Draft): string => clip(draft.text.trim(), textLimit);
export const trimmedName = (draft: Draft): string => clip(draft.gameName.trim(), nameLimit);

/** Something was typed: the text, or the name of a game idea. */
export const hasTypedText = (draft: Draft): boolean => trimmedText(draft) !== "" || trimmedName(draft) !== "";

/** The send button waits for the required text. */
export const canSendDraft = (draft: Draft): boolean => trimmedText(draft) !== "";

/** Whether a screenshot goes with the report: the type takes one and the switch is on. */
export const sendsScreenshot = (draft: Draft): boolean => takesScreenshot(draft.type) && draft.screenshotOn;
