/** An event for a live socket: `type` plus its data, sent as one JSON text frame. */
export type LiveEvent = { type: "message" | "read" | "presence" | "divan" } & Record<string, unknown>;

/**
 * The live connections of this process, by user. It lives in memory, so it works for one server instance only:
 * with several instances the events would have to travel through Postgres LISTEN/NOTIFY or Redis (see the README).
 */
export function createHub() {
  const sockets = new Map<string, Set<(event: LiveEvent) => void>>();
  return {
    /** Registers an authenticated socket. `first` is true when the user was offline before; `remove` returns true when it was their last socket. */
    add(userId: string, send: (event: LiveEvent) => void) {
      let set = sockets.get(userId);
      const first = !set;
      if (!set) sockets.set(userId, (set = new Set()));
      set.add(send);
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
      for (const send of sockets.get(userId) ?? []) send(event);
    },
  };
}

export type Hub = ReturnType<typeof createHub>;
