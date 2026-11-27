import { devPagesEnabled } from "../dev";
import type { LiveSocketFactory } from "./liveConnection";
import { conversationId } from "./debugIds";

/** The real socket: the browser's `WebSocket`. A close without a code the server gave (1005, 1006) is a lost socket. */
const browserSockets: LiveSocketFactory = {
  open(url, handlers) {
    const socket = new WebSocket(url);
    socket.onopen = () => handlers.open();
    socket.onmessage = (event) => typeof event.data === "string" && handlers.frame(event.data);
    socket.onclose = (event) => handlers.close(event.code >= 4000 ? event.code : undefined);
    return { send: (text) => socket.send(text), close: () => socket.close() };
  },
};

/** The fake socket of `sessionStorage.beytLive = "1"` (the phone's `-beytLive 1`): ready at once, and a message from Sara a moment later. */
const debugSockets: LiveSocketFactory = {
  open(_url, handlers) {
    setTimeout(() => {
      handlers.open();
      handlers.frame('{"type":"ready"}');
      setTimeout(() => handlers.frame(JSON.stringify({ type: "message", message: { id: "live1", conversationId: conversationId("sara.ghazal"), kind: "text", fromMe: false, text: "یه پیام زنده از سارا", key: null, note: null, payload: null, deleted: false, createdAt: new Date().toISOString() } })), 1500);
    });
    return { send: () => {}, close: () => {} };
  },
};

/** The socket of this page: the browser's, or in a debug build the fake one when `beytLive` is set. */
export const liveSockets: LiveSocketFactory = { open: (url, handlers) => (devPagesEnabled() && sessionStorage.getItem("beytLive") === "1" ? debugSockets : browserSockets).open(url, handlers) };
