import { persianDigits } from "../persian";
import type { ScreenName } from "./screens";

/** `technical.network` of the contract. */
export type NetworkKind = "wifi" | "cellular" | "offline" | "unknown";

const networkTitles: Record<NetworkKind, string> = { wifi: "وای‌فای", cellular: "اینترنت گوشی", offline: "بدون اینترنت", unknown: "نامشخص" };

/** The browser's own word for how it is connected (`navigator.connection`, where there is one). */
export function networkKind(online: boolean, connection?: string): NetworkKind {
  if (!online) return "offline";
  return connection === "wifi" || connection === "cellular" ? connection : "unknown";
}

/** `technical.accountState` of the contract. */
export type AccountState = "guest" | "signedIn";

/** A value of `technical.textSettings`: a short string, a number or a switch. */
export type SettingValue = string | number | boolean;

/** `technical` of the contract: the only things a bug report may say about the browser's state. Never typed text, messages, a phone number, an address or a place. The screen can see exactly this under «ببین چیه». */
export type TechnicalInfo = {
  screen: ScreenName;
  /** `<poemPath>#<coupletIndex>` while a poem is open. */
  couplet?: string;
  mode?: string;
  /** Seconds into the recitation. */
  recitationPosition?: number;
  textSettings: Record<string, SettingValue>;
  network: NetworkKind;
  accountState: AccountState;
  /** Codes such as «429 rate_limited», never messages. */
  recentErrors: string[];
  steps: ScreenName[];
};

/** The keys the server allows (`FeedbackTechnical`); a test keeps the encoding inside this list. */
export const allowedKeys: ReadonlySet<string> = new Set(["screen", "couplet", "mode", "recitationPosition", "textSettings", "network", "accountState", "recentErrors", "steps"]);
export const listLimit = 20;

/** A reader position as the contract writes it, or undefined for a path or index it would refuse. */
export function coupletKey(path: string, index: number): string | undefined {
  const key = `${path}#${index}`;
  return key.length <= 200 && /^\/[a-z0-9_\-/]+#\d{1,5}$/.test(key) ? key : undefined;
}

/** `info` as the body of the report says it: empty lists and settings are left out, long things cut. */
export function technicalBody(info: TechnicalInfo): Record<string, unknown> {
  const settings = Object.fromEntries(Object.entries(info.textSettings).map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 40) : value]));
  return {
    screen: info.screen,
    ...(info.couplet === undefined ? {} : { couplet: info.couplet }),
    ...(info.mode === undefined ? {} : { mode: info.mode }),
    ...(info.recitationPosition === undefined ? {} : { recitationPosition: info.recitationPosition }),
    ...(Object.keys(settings).length === 0 ? {} : { textSettings: settings }),
    network: info.network,
    accountState: info.accountState,
    ...(info.recentErrors.length === 0 ? {} : { recentErrors: info.recentErrors.slice(-listLimit).map((code) => code.slice(0, 200)) }),
    ...(info.steps.length === 0 ? {} : { steps: info.steps.slice(-listLimit) }),
  };
}

export type Row = { label: string; value: string };

const settingLabels: Record<string, string> = { size: "اندازه", font: "قلم", bold: "پررنگ", layout: "چیدمان", spacing: "فاصله", theme: "زمینه" };
const settingOrder = Object.keys(settingLabels);

const display = (value: SettingValue): string => (typeof value === "number" ? persianDigits(value) : typeof value === "boolean" ? (value ? "بله" : "نه") : value);

/** The same facts as `technicalBody`, in Persian: what the person sees is what is sent. */
export function technicalRows(info: TechnicalInfo): Row[] {
  const order = (key: string): number => (settingOrder.includes(key) ? settingOrder.indexOf(key) : 99);
  const settings = Object.entries(info.textSettings).sort(([a], [b]) => order(a) - order(b));
  return [
    { label: "صفحه", value: info.screen },
    ...(info.couplet === undefined ? [] : [{ label: "بیت", value: info.couplet }]),
    ...(info.mode === undefined ? [] : [{ label: "حالت خوندن", value: info.mode }]),
    ...(info.recitationPosition === undefined ? [] : [{ label: "جای خوانش", value: `${persianDigits(Math.floor(info.recitationPosition))} ثانیه` }]),
    ...settings.map(([key, value]) => ({ label: `متن · ${settingLabels[key] ?? key}`, value: display(value) })),
    { label: "اینترنت", value: networkTitles[info.network] },
    { label: "حساب", value: info.accountState === "guest" ? "مهمان" : "واردشده" },
    { label: "خطاهای اخیر", value: info.recentErrors.length === 0 ? "هیچی" : info.recentErrors.slice(-listLimit).join("، ") },
    { label: "کارهای قبلش", value: info.steps.length === 0 ? "هیچی" : info.steps.slice(-listLimit).join("، ") },
  ];
}
