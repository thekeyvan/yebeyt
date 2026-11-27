import type { Call } from "../account/api";
import type { PublicProfile } from "../friends/models";
import type { Author, Content, Conversation, ConversationPage, Message, MessagePage, SharedDivan, SharedDivanItem, SharedDivanItemPage, SharedDivanPage } from "./models";

const at = (id: string): string => encodeURIComponent(id);
const paged = (name: string, cursor: string | undefined, extra: Record<string, string> = {}) => ({ query: { ...extra, ...(cursor === undefined ? {} : { [name]: cursor }) } });

/** The calls of messages and shared divans (Messages/MessagesAPI.swift), through the web app's door. */
export function messagesApi(call: Call) {
  return {
    conversations: (cursor?: string) => call<ConversationPage>("GET", "/v1/conversations", paged("cursor", cursor)),
    /** The chat with someone, made if there is none. 403 `messages_closed` when they don't take messages from me. */
    openConversation: (username: string) => call<Conversation>("POST", "/v1/conversations", { body: { username } }),
    messages: (conversation: string, before?: string) => call<MessagePage>("GET", `/v1/conversations/${at(conversation)}/messages`, paged("before", before)),
    /** The message that was made (200 for a `clientId` already sent, 201 for a new one). */
    sendMessage: (conversation: string, clientId: string, content: Content) => call<Message>("POST", `/v1/conversations/${at(conversation)}/messages`, { body: { clientId, ...content } }),
    markRead: (conversation: string, messageId: string) => call<void>("PUT", `/v1/conversations/${at(conversation)}/read`, { body: { messageId } }),
    deleteMessage: (id: string) => call<void>("DELETE", `/v1/messages/${at(id)}`),
    /** The person's league tier this week (0 to 4), when the server tells it; the chat header says «لیگ <tier>». */
    leagueTier: async (username: string) => (await call<PublicProfile>("GET", `/v1/users/${at(username)}`)).league?.tier,
    sharedDivans: (cursor?: string) => call<SharedDivanPage>("GET", "/v1/shared-divans", paged("cursor", cursor)),
    /** The divan shared with a friend, made if there is none. 403 `forbidden` when we are not friends. */
    openSharedDivan: (username: string) => call<SharedDivan>("POST", "/v1/shared-divans", { body: { username } }),
    sharedDivanItems: (id: string, by: Author, cursor?: string) => call<SharedDivanItemPage>("GET", `/v1/shared-divans/${at(id)}/items`, paged("cursor", cursor, { by })),
    addSharedDivanItem: (id: string, key: string, note?: string) => call<SharedDivanItem>("POST", `/v1/shared-divans/${at(id)}/items`, { body: { key, ...(note === undefined ? {} : { note }) } }),
    /** Takes a couplet I added out of the divan (204; 403 when the other person added it). Its likes go with it. */
    removeSharedDivanItem: (id: string, item: string) => call<void>("DELETE", `/v1/shared-divans/${at(id)}/items/${at(item)}`),
    setSharedDivanLike: (id: string, item: string, liked: boolean) => call<SharedDivanItem>(liked ? "PUT" : "DELETE", `/v1/shared-divans/${at(id)}/items/${at(item)}/like`),
  };
}
