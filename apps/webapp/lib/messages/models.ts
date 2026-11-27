import type { components } from "../api/schema";

// The messages part of the contract (`packages/api/openapi.json`): chats, messages, shared divans (Messages/MessageModels.swift).
type Schemas = components["schemas"];

/** The other person of a chat. `online` is null when they don't let others see it; `canPlay` is false only for the demo friend «یه بیت» (the chat hides the game chips), and a server that doesn't say counts as yes. */
export type ChatPerson = Omit<Schemas["ChatPerson"], "online" | "canPlay"> & { online?: boolean | null; canPlay?: boolean };
export type MessageKind = Schemas["Message"]["kind"];
export type ConversationLast = Schemas["ConversationLast"];
export type ConversationItem = Omit<Schemas["ConversationListItem"], "other"> & { other: ChatPerson };
export type Conversation = Omit<Schemas["Conversation"], "other"> & { other: ChatPerson };
export type ConversationPage = { items: ConversationItem[]; nextCursor: string | null };
export type Message = Schemas["Message"];
export type MessagePage = Schemas["MessagePage"];
export type SharedDivanCounts = Schemas["SharedDivanCounts"];
export type SharedDivan = Schemas["SharedDivan"];
export type SharedDivanPage = Schemas["SharedDivanPage"];
export type SharedDivanItem = Schemas["SharedDivanItem"];
export type SharedDivanItemPage = Schemas["SharedDivanItemPage"];

/** What a system or game message carries: `{ event, … }` (`divan_add` has the couplet `key`; `game_invite` the `gameId`, `kind` and `code`; `game_ended` the `kind` and `by`, the winner's user id; `challenge_result` the `score`). */
export type MessagePayload = { event: string; key?: string; kind?: string; gameId?: string; code?: string; game?: string; score?: number; seconds?: number; reason?: string; by?: string };

/** The `payload` of a message as the page reads it, or undefined when it has none. */
export const payloadOf = (message: Pick<Message, "payload">): MessagePayload | undefined => (typeof message.payload?.event === "string" ? (message.payload as MessagePayload) : undefined);

/** A message to send: a text, or a couplet with an optional note. `clientId` makes a retry safe. */
export type Content = { kind: "text"; text: string } | { kind: "couplet"; key: string; note?: string };

export type Author = "all" | "me" | "them";

/** The name shown: the display name, else the username. */
export const chatName = (person: Pick<ChatPerson, "username" | "displayName">): string => (person.displayName?.trim() ? person.displayName : person.username);

/** Counts toward «نخونده», as on the server: anything the other person sent (text, couplet, game), not deleted; system lines have no sender and never count. */
export const countsAsUnread = (message: Pick<Message, "fromMe" | "deleted" | "kind">): boolean => !message.fromMe && !message.deleted && message.kind !== "system";

/** A kind this app does not know is read as a system line, which hides itself when it has no event it knows. */
export const known = (message: Message): Message => (["text", "couplet", "system", "game"].includes(message.kind) ? message : { ...message, kind: "system" });
