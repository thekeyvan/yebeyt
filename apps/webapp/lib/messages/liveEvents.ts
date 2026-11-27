import type { PersonShort } from "../friends/models";
import { decodeGameEvent, type GameEvent } from "../play/liveGameEvents";
import { known, type Message, type SharedDivanItem } from "./models";

/** What the server sends over `/v1/live` that this app uses (Messages/LiveSocket.swift `LiveEvent`). The games' events are `GameEvent`s (`lib/play/liveGameEvents.ts`). */
export type LiveEvent =
  | { type: "ready" }
  | { type: "message"; message: Message }
  | { type: "read"; conversationId: string; username: string; messageId: string }
  | { type: "deleted"; conversationId: string; messageId: string }
  | { type: "presence"; username: string; online: boolean }
  | { type: "divan"; sharedDivanId: string; item: SharedDivanItem }
  /** The person who added a couplet took it out of the shared divan. */
  | { type: "divan.removed"; sharedDivanId: string; itemId: string }
  /** Someone asked me to be friends. */
  | { type: "friend.request"; from: PersonShort }
  /** Someone accepted the request I sent. */
  | { type: "friend.accepted"; from: PersonShort }
  | GameEvent
  | { type: "other"; name: string };

const isText = (value: unknown): value is string => typeof value === "string";
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isMessage = (value: unknown): value is Message => isObject(value) && isText(value.id) && isText(value.conversationId) && isText(value.kind) && typeof value.fromMe === "boolean" && typeof value.deleted === "boolean" && isText(value.createdAt);
const isItem = (value: unknown): value is SharedDivanItem => isObject(value) && isText(value.id) && isText(value.key) && typeof value.addedByMe === "boolean" && isText(value.createdAt) && typeof value.likedByMe === "boolean" && typeof value.likedByThem === "boolean";
const isPerson = (value: unknown): value is PersonShort => isObject(value) && isText(value.username);

/** The event of a text frame; undefined when it is not JSON or its fields are not as the contract says. */
export function decodeLive(text: string): LiveEvent | undefined {
  let frame: Record<string, unknown> & { type: string };
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isObject(parsed) || !isText(parsed.type)) return undefined;
    frame = { ...parsed, type: parsed.type };
  } catch {
    return undefined;
  }
  const { type, message, conversationId, username, messageId, online, sharedDivanId, item, itemId, from } = frame;
  switch (type) {
    case "ready":
      return { type };
    case "message":
      return isMessage(message) ? { type, message: known(message) } : undefined;
    case "read":
      return isText(conversationId) && isText(username) && isText(messageId) ? { type, conversationId, username, messageId } : undefined;
    case "deleted":
      return isText(conversationId) && isText(messageId) ? { type, conversationId, messageId } : undefined;
    case "presence":
      return isText(username) && typeof online === "boolean" ? { type, username, online } : undefined;
    case "divan":
      return isText(sharedDivanId) && isItem(item) ? { type, sharedDivanId, item } : undefined;
    case "divan.removed":
      return isText(sharedDivanId) && isText(itemId) ? { type, sharedDivanId, itemId } : undefined;
    case "friend.request":
    case "friend.accepted":
      return isPerson(from) ? { type, from } : undefined;
    default:
      return decodeGameEvent(type, frame) ?? { type: "other", name: type };
  }
}
