import { describe, expect, it } from "vitest";
import { deviceInfo, type DeviceInfo } from "../lib/feedback/device";
import { buildPayload } from "../lib/feedback/payload";
import type { TechnicalInfo } from "../lib/feedback/technical";
import { canSendDraft, clip, hasTypedText, menuOrder, newDraft, sendsScreenshot, takesRecording, takesScreenshot, textLimit, trimmedText, type Draft, type FeedbackType } from "../lib/feedback/types";

const device: DeviceInfo = { appVersion: "6a184da", deviceModel: "Chrome 130 · 375×667 · fa-IR", osVersion: "Android 14" };
const info: TechnicalInfo = {
  screen: "خوندن شعر",
  couplet: "/hafez/ghazal/sh3#2",
  mode: "بیت به بیت",
  recitationPosition: 12.5,
  textSettings: { size: 21 },
  network: "wifi",
  accountState: "guest",
  recentErrors: ["429 rate_limited"],
  steps: ["خونه", "کاوش", "خوندن شعر"],
};

const body = (type: FeedbackType, edit: (draft: Draft) => void = () => {}): Record<string, unknown> => {
  const draft = newDraft(type);
  draft.text = "  نوشته  ";
  edit(draft);
  return buildPayload(draft, info, device) as unknown as Record<string, unknown>;
};

const keys = (json: Record<string, unknown>): string[] => Object.keys(json).sort();

describe("the body of a report is shaped by the rules of its type (FeedbackPayloadTests)", () => {
  it("a bug carries the text, frequency, screen and technical info", () => {
    const json = body("bug", (draft) => void (draft.frequency = "once"));
    expect(json.type).toBe("bug");
    expect(json.text).toBe("نوشته");
    expect(json.frequency).toBe("once");
    expect(json.screen).toBe("خوندن شعر");
    expect(json.technical).toBeTypeOf("object");
    expect(json.game).toBeUndefined();
    expect(keys(json)).toEqual(["appVersion", "deviceModel", "frequency", "osVersion", "screen", "technical", "text", "type"]);
  });

  it("an annoying thing carries the screen name but no technical info", () => {
    const json = body("annoyed");
    expect(keys(json)).toEqual(["appVersion", "deviceModel", "osVersion", "screen", "text", "type"]);
    expect(json.screen).toBe("خوندن شعر");
  });

  it("ideas and thanks carry only the text", () => {
    for (const type of ["idea", "liked"] as const) expect(keys(body(type))).toEqual(["appVersion", "deviceModel", "osVersion", "text", "type"]);
  });

  it("a game idea carries the game and no text, and its name is optional", () => {
    const json = body("game", (draft) => {
      draft.gameName = " بیت عوضی ";
      draft.players = "both";
    });
    expect(keys(json)).toEqual(["appVersion", "deviceModel", "game", "osVersion", "type"]);
    expect(json.game).toEqual({ name: "بیت عوضی", how: "نوشته", players: "both" });
    expect((body("game").game as Record<string, unknown>).name).toBeUndefined();
  });

  it("every type sends the app version, the browser and the system", () => {
    for (const type of ["bug", "annoyed", "idea", "game", "liked"] as const) {
      const json = body(type);
      expect([json.appVersion, json.deviceModel, json.osVersion]).toEqual([device.appVersion, device.deviceModel, device.osVersion]);
    }
  });
});

describe("the draft", () => {
  it("the send button waits for the required text, and the text is cut at the server's 2000", () => {
    for (const type of menuOrder) {
      const draft = newDraft(type);
      expect(canSendDraft(draft)).toBe(false);
      draft.text = "  \n ";
      expect(canSendDraft(draft)).toBe(false);
      draft.text = "ب";
      expect(canSendDraft(draft)).toBe(true);
    }
    const long = newDraft("idea");
    long.text = "ا".repeat(3000);
    expect(trimmedText(long)).toHaveLength(textLimit);
  });

  it("a cut never leaves half of a pair", () => {
    expect(clip("ab😀", 3)).toBe("ab");
    expect(clip("ab😀", 4)).toBe("ab😀");
  });

  it("the screenshot switch starts as the table says", () => {
    expect(newDraft("bug").screenshotOn).toBe(true);
    expect(newDraft("annoyed").screenshotOn).toBe(true);
    expect(newDraft("idea").screenshotOn).toBe(false);
    expect(takesScreenshot("idea")).toBe(true);
    expect(takesScreenshot("game") || takesScreenshot("liked")).toBe(false);
    const game = newDraft("game");
    game.screenshotOn = true;
    expect(sendsScreenshot(game)).toBe(false);
    expect(takesRecording("bug") && !takesRecording("annoyed")).toBe(true);
  });

  it("a game idea with only a name counts as written, spaces do not", () => {
    const game = newDraft("game");
    game.gameName = "بیت عوضی";
    expect(hasTypedText(game)).toBe(true);
    const idea = newDraft("idea");
    idea.text = "  \n ";
    expect(hasTypedText(idea)).toBe(false);
  });
});

describe("the browser and the system come from the user agent", () => {
  const facts = (userAgent: string) => ({ userAgent, width: 390.4, height: 844, language: "fa-IR" });
  const chrome = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
  const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

  it("names the browser with its size and language, and the system", () => {
    expect(deviceInfo("6a184da", facts(chrome))).toEqual({ appVersion: "6a184da", deviceModel: "Chrome 130 · 390×844 · fa-IR", osVersion: "Android 14" });
    expect(deviceInfo("6a184da", facts(safari))).toEqual({ appVersion: "6a184da", deviceModel: "Safari 17 · 390×844 · fa-IR", osVersion: "iOS 17.5" });
    expect(deviceInfo("x", facts("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0")).osVersion).toBe("Windows 10");
    expect(deviceInfo("x", facts("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0")).deviceModel).toMatch(/^Edge 130/);
  });

  it("keeps to the server's lengths", () => {
    const long = deviceInfo("a".repeat(50), { userAgent: "x", width: 1, height: 1, language: "l".repeat(60) });
    expect(long.appVersion).toHaveLength(20);
    expect(long.deviceModel.length).toBeLessThanOrEqual(40);
    expect(long.osVersion.length).toBeLessThanOrEqual(20);
  });
});
