import { messageOf } from "../account/api";
import { Store } from "../reader/store";
import type { FriendsCenter } from "./center";
import { friendToast, requires, resultOf, type FriendAction } from "./friendship";
import type { Api } from "../account/api";
import type { FoundPerson, Phase } from "./models";

type State = { people: readonly FoundPerson[]; pending: ReadonlySet<string>; phase: Phase | { kind: "idle" } };

/** The server wants at least two characters. */
export const shortestQuery = 2;

/** What is searched for: without spaces or a leading «@», in lowercase (usernames are). */
export function normalized(text: string): string {
  const name = text.trim();
  return (name.startsWith("@") ? name.slice(1) : name).toLowerCase();
}

/**
 * «پیدا کردن دوست»: people by the start of their username (Friends/People.swift). The search waits for a short pause in typing, and an answer that arrives after
 * the text changed is dropped.
 */
export class PeopleSearchModel extends Store<State> {
  private timer?: ReturnType<typeof setTimeout>;
  private run = 0;
  private inFlight: Promise<void> = Promise.resolve();

  constructor(
    private readonly api: Pick<Api, "searchUsers" | "friendAction">,
    private readonly center?: Pick<FriendsCenter, "friendshipChanged">,
    private readonly debounce = 300,
  ) {
    super({ people: [], pending: new Set(), phase: { kind: "idle" } });
  }

  /** The text of the field changed. */
  queryChanged(text: string): void {
    clearTimeout(this.timer);
    const run = ++this.run;
    const query = normalized(text);
    if ([...query].length < shortestQuery) {
      this.inFlight = Promise.resolve();
      this.update({ people: [], phase: { kind: "idle" } });
      return;
    }
    this.update({ phase: { kind: "loading" } });
    this.inFlight = new Promise((done) => {
      this.timer = setTimeout(async () => {
        try {
          const found = await this.api.searchUsers(query);
          if (run === this.run) this.update({ people: found, phase: { kind: "loaded" } });
        } catch (error) {
          if (run === this.run) this.update({ people: [], phase: { kind: "failed", message: messageOf(error) } });
        }
        done();
      }, this.debounce);
    });
  }

  /** Waits for the search in flight (for tests). */
  settle(): Promise<void> {
    return this.inFlight;
  }

  /**
   * Does `action` to the row of `username`: the row changes at once and goes back when the server refuses. Returns the line to show when it failed.
   */
  async perform(action: FriendAction, username: string): Promise<string | undefined> {
    const { people, pending } = this.snapshot();
    if (pending.has(username) || people.find((person) => person.username === username)?.friendship !== requires(action)) return undefined;
    this.update({ pending: new Set(pending).add(username) });
    this.setFriendship(username, resultOf(action));
    try {
      const state = await this.api.friendAction(action, username);
      this.setFriendship(username, state);
      this.center?.friendshipChanged(username, action, state);
      return undefined;
    } catch (error) {
      this.setFriendship(username, requires(action));
      return friendToast(error);
    } finally {
      const left = new Set(this.snapshot().pending);
      left.delete(username);
      this.update({ pending: left });
    }
  }

  private setFriendship(username: string, friendship: FoundPerson["friendship"]): void {
    this.update({ people: this.snapshot().people.map((person) => (person.username === username ? { ...person, friendship, isFriend: friendship === "friends" } : person)) });
  }

  private update(change: Partial<State>): void {
    this.set({ ...this.snapshot(), ...change });
  }
}
