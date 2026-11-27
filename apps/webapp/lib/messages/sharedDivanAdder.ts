import type { Api } from "../account/api";
import { Store } from "../reader/store";
import { maxNoteLength } from "./chat";
import { addedToDivan, limited, messageToast } from "./copy";
import { chatName, type ChatPerson, type SharedDivan } from "./models";

/** Where a couplet is going: the key, and the person when the long press happened in a chat with them (then nobody needs to be chosen). */
export type SharedDivanTarget = { key: string; person?: ChatPerson };

type State = {
  divans: readonly SharedDivan[];
  friends: readonly ChatPerson[];
  isLoading: boolean;
  showsFriends: boolean;
  /** `done` carries the line to show after the sheet closes. */
  phase: "choosing" | "adding" | { done: string };
  /** The person picked in the list; the note and «اضافه کن» come next. */
  chosen?: ChatPerson;
  note: string;
  /** A refusal, shown in the sheet: «فقط با دوستات می‌شه دیوان مشترک داشت». */
  failure?: string;
};

type AdderApi = Pick<Api, "sharedDivans" | "friends" | "openSharedDivan" | "addSharedDivanItem">;

/**
 * «به دیوان مشترک»: choose whose shared divan, write a note if you like, and add the couplet (Messages/SharedDivanAdder.swift). The sheet lists the friends I already
 * share a divan with; «با یه دوست دیگه» lists my other friends, and the divan is made for the one chosen (the server only does it for friends).
 */
export class SharedDivanAdder extends Store<State> {
  readonly key: string;
  /** The person already known (the chat's), else undefined and the sheet lists people. */
  readonly person?: ChatPerson;

  constructor(
    target: SharedDivanTarget,
    private readonly api: AdderApi,
  ) {
    super({ divans: [], friends: [], isLoading: false, showsFriends: false, phase: "choosing", chosen: target.person, note: "" });
    this.key = target.key;
    this.person = target.person;
  }

  /** People with a shared divan first; asked once. */
  async load(): Promise<void> {
    if (this.person || this.snapshot().divans.length > 0 || this.snapshot().isLoading) return;
    this.update({ isLoading: true });
    try {
      const divans: SharedDivan[] = [];
      let next: string | undefined;
      do {
        const page = await this.api.sharedDivans(next);
        divans.push(...page.items);
        next = page.nextCursor ?? undefined;
      } while (next !== undefined);
      this.update({ divans });
    } catch {
      // The sheet offers «با یه دوست دیگه».
    } finally {
      this.update({ isLoading: false });
    }
  }

  /** «با یه دوست دیگه»: my friends who have no shared divan yet. */
  async showFriends(): Promise<void> {
    this.update({ showsFriends: true });
    if (this.snapshot().friends.length > 0) return;
    this.update({ isLoading: true });
    const found: ChatPerson[] = [];
    try {
      let next: string | undefined;
      do {
        const page = await this.api.friends(next);
        found.push(...page.items.map(({ username, displayName, avatar }) => ({ username, displayName, avatar, online: null })));
        next = page.nextCursor ?? undefined;
      } while (next !== undefined);
    } catch {
      // What was read is listed.
    }
    const have = new Set(this.snapshot().divans.map((divan) => divan.other.username));
    this.update({ friends: found.filter((friend) => !have.has(friend.username)), isLoading: false });
  }

  choose(person: ChatPerson | undefined): void {
    this.update({ chosen: person });
  }

  setNote(note: string): void {
    this.update({ note: limited(note, maxNoteLength) });
  }

  /** Adds the couplet to the divan with `chosen`. Returns true when it is in. */
  async add(): Promise<boolean> {
    const { chosen, phase, divans, note } = this.snapshot();
    if (!chosen || phase !== "choosing") return false;
    this.update({ phase: "adding", failure: undefined });
    const trimmed = note.trim();
    try {
      const known = divans.find((divan) => divan.other.username === chosen.username);
      const id = known ? known.id : (await this.api.openSharedDivan(chosen.username)).id;
      await this.api.addSharedDivanItem(id, this.key, trimmed === "" ? undefined : limited(trimmed, maxNoteLength));
      this.update({ phase: { done: addedToDivan(chatName(chosen)) } });
      return true;
    } catch (error) {
      this.update({ failure: messageToast(error, true), phase: "choosing" });
      return false;
    }
  }

  private update(change: Partial<State>): void {
    this.set({ ...this.snapshot(), ...change });
  }
}
