import type { SessionLike } from "../account/session";
import { Store } from "../reader/store";

type Blocks = ReadonlyMap<string, ReadonlySet<string>>;

/**
 * Whom I blocked since the page opened, by the account that did it (Friends/BlockedPeople.swift). The lists that were loaded before (search, friends, the
 * home feed) drop them at once; what the server sends next time leaves them out by itself. Another account, or nobody signed in, sees none of them.
 */
export class BlockedPeople extends Store<Blocks> {
  constructor(private readonly session: Pick<SessionLike, "user">) {
    super(new Map());
  }

  /** Whom the signed-in account blocked. */
  get usernames(): ReadonlySet<string> {
    const id = this.session.user?.id;
    return (id !== undefined && this.snapshot().get(id)) || new Set();
  }

  add(username: string): void {
    const id = this.session.user?.id;
    if (id === undefined) return;
    this.set(new Map(this.snapshot()).set(id, new Set(this.usernames).add(username)));
  }

  /** `items` without the blocked people; `username` says whose each one is. */
  visible<Item>(items: readonly Item[], username: (item: Item) => string): Item[] {
    const hidden = this.usernames;
    return items.filter((item) => !hidden.has(username(item)));
  }
}
