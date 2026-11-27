"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

/** How near the bottom counts as being at the bottom. */
const nearPx = 48;

/**
 * The scrolling of a chat (Messages/ChatScreen.swift `list`): it opens at the bottom; what is sent scrolls into view, and what comes while someone is reading higher
 * up only shows the pill «پیام تازه» (`newBelow`); an older page added at the top keeps what was on screen where it was. `last` is the key of the last row, and `lastIsMine` says
 * whether it is a send of mine.
 */
export function useChatScroll(last: string | undefined, lastIsMine: boolean) {
  const list = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const settled = useRef(false);
  const [newBelow, setNewBelow] = useState(false);

  const toBottom = useCallback((smooth: boolean) => {
    const node = list.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: smooth ? "smooth" : "instant" });
    setNewBelow(false);
  }, []);

  useLayoutEffect(() => {
    if (last === undefined) return;
    if (!settled.current) {
      settled.current = true;
      return toBottom(false); // the first messages: the chat opens at the bottom
    }
    if (atBottom.current || lastIsMine) toBottom(true);
    else setNewBelow(true);
  }, [last]);

  const onScroll = useCallback(() => {
    const node = list.current;
    if (!node) return;
    atBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < nearPx;
    if (atBottom.current) setNewBelow(false);
  }, []);

  /** Runs `load` (which adds older messages at the top) and keeps the message that was at the top where it was. */
  const keepingPlace = useCallback(async (load: () => Promise<void>) => {
    const node = list.current;
    if (!node) return load();
    const before = { height: node.scrollHeight, top: node.scrollTop };
    await load();
    requestAnimationFrame(() => (node.scrollTop = before.top + node.scrollHeight - before.height));
  }, []);

  return { list, topRef, onScroll, newBelow, toBottom, keepingPlace };
}
