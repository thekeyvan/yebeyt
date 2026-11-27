/** The id of the chat with `username` on the debug server (`lib/api/stubMessages.ts`), which the fake socket's message names too. */
export const conversationId = (username: string): string => `c-${username.replaceAll(".", "_")}`;
