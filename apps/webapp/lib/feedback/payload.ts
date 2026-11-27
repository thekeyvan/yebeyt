import type { DeviceInfo } from "./device";
import { technicalBody, type TechnicalInfo } from "./technical";
import { sendsScreen, sendsTechnical, trimmedName, trimmedText, type Draft } from "./types";

/** The body of `POST /v1/feedback`, shaped by the rules of the type (`FeedbackRequest` in packages/api/openapi.json). Only the parts the type takes are used. */
export type Payload = {
  type: string;
  text?: string;
  frequency?: string;
  game?: { name?: string; how: string; players: string };
  screen?: string;
  technical?: Record<string, unknown>;
  appVersion: string;
  deviceModel: string;
  osVersion: string;
};

/** `info` is what the browser knew when the person asked to give feedback. */
export function buildPayload(draft: Draft, info: TechnicalInfo, device: DeviceInfo): Payload {
  const { type } = draft;
  const name = trimmedName(draft);
  return {
    type,
    ...(type === "game" ? { game: { ...(name === "" ? {} : { name }), how: trimmedText(draft), players: draft.players } } : { text: trimmedText(draft) }),
    ...(type === "bug" ? { frequency: draft.frequency } : {}),
    ...(sendsScreen(type) ? { screen: info.screen } : {}),
    ...(sendsTechnical(type) ? { technical: technicalBody(info) } : {}),
    appVersion: device.appVersion,
    deviceModel: device.deviceModel,
    osVersion: device.osVersion,
  };
}
