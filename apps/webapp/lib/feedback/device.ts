import { clip } from "./types";

/** The app's version, the model and the system version: they go with every report, silently. On the web the version is the build's git sha, the «model» the browser with the size of its screen and its language, the system the one in its user agent. */
export type DeviceInfo = { appVersion: string; deviceModel: string; osVersion: string };

export type BrowserFacts = { userAgent: string; width: number; height: number; language: string };

const browsers: readonly (readonly [RegExp, string])[] = [
  [/(?:Edg|EdgA|EdgiOS)\/(\d+)/, "Edge"],
  [/OPR\/(\d+)/, "Opera"],
  [/(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
  [/(?:Chrome|CriOS)\/(\d+)/, "Chrome"],
  [/Version\/(\d+)[^]*Safari/, "Safari"],
];

function browserOf(userAgent: string): string {
  for (const [pattern, name] of browsers) {
    const version = pattern.exec(userAgent)?.[1];
    if (version) return `${name} ${version}`;
  }
  return "browser";
}

function systemOf(userAgent: string): string {
  const ios = /(?:iPhone|iPad|iPod)[^]*? OS (\d+)[_.](\d+)/.exec(userAgent);
  if (ios) return `iOS ${ios[1]}.${ios[2]}`;
  const android = /Android (\d+)/.exec(userAgent);
  if (android) return `Android ${android[1]}`;
  if (/Windows NT 10/.test(userAgent)) return "Windows 10";
  if (/Windows/.test(userAgent)) return "Windows";
  if (/Mac OS X/.test(userAgent)) return "macOS";
  if (/CrOS/.test(userAgent)) return "ChromeOS";
  if (/Linux/.test(userAgent)) return "Linux";
  return "unknown";
}

/** `version` is the build's git sha. */
export function deviceInfo(version: string, { userAgent, width, height, language }: BrowserFacts): DeviceInfo {
  return {
    appVersion: clip(version, 20),
    deviceModel: clip(`${browserOf(userAgent)} · ${Math.round(width)}×${Math.round(height)} · ${language}`, 40),
    osVersion: clip(systemOf(userAgent), 20),
  };
}

/** What this tab knows now. */
export const currentDevice = (): DeviceInfo =>
  deviceInfo(process.env.NEXT_PUBLIC_BUILD || "dev", { userAgent: navigator.userAgent, width: window.innerWidth, height: window.innerHeight, language: navigator.language });
