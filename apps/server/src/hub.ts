/** An event for a live socket: `type` plus its data, sent as one JSON text frame. */
export type LiveEvent = {
  type: "message" | "deleted" | "read" | "presence" | "divan" | "divan.removed" | "game.started" | "game.move" | "game.turn" | "game.ended" | "duel.question" | "duel.answered" | "duel.round" | "challenge.result" | "friend.request" | "friend.accepted";
} & Record<string, unknown>;

export const MAX_SOCKETS_PER_USER = 5;

/**
 * The live connections of this process, by user. It lives in memory, so it works for one server instance only:
 * with several instances the events would have to travel through Postgres LISTEN/NOTIFY or Redis (see the README).
 */
export function createHub() {
  const sockets = new Map<string, Map<(event: LiveEvent) => void, () => void>>();
  return {
    /**
     * Registers an authenticated socket. `first` is true when the user was offline before; `remove` returns true when it was their last socket.
     * A user keeps at most 5 sockets: past that, the oldest is dropped and its `close` is called.
     */
    add(userId: string, send: (event: LiveEvent) => void, close: () => void = () => {}) {
      let set = sockets.get(userId);
      const first = !set;
      if (!set) sockets.set(userId, (set = new Map()));
      set.set(send, close);
      while (set.size > MAX_SOCKETS_PER_USER) {
        const [oldest, closeOldest] = set.entries().next().value!;
        set.delete(oldest);
        closeOldest();
      }
      return {
        first,
        remove(): boolean {
          if (!set.delete(send)) return false;
          if (set.size > 0) return false;
          sockets.delete(userId);
          return true;
        },
      };
    },
    /** True while the user has at least one authenticated socket. */
    isOnline: (userId: string): boolean => sockets.has(userId),
    /** Sends the event to every socket of the user, if any. */
    publish(userId: string, event: LiveEvent) {
      for (const send of sockets.get(userId)?.keys() ?? []) send(event);
    },
  };
}

export type Hub = ReturnType<typeof createHub>;
