import type { Api } from "../account/api";
import type { FoundPerson, PersonShort } from "../friends/models";
import { nameOf as gameName } from "../games/kinds";
import { Store } from "../reader/store";
import { playCopy } from "./copy";
import type { FriendGames } from "./friendGames";
import type { ChallengeGame, FriendGame, GameCreated, GameKind } from "./models";

/** The four games of the lobby, in the board's order. جورچین and حدس شاعر are challenges: the player plays the ten couplets first and the challenge goes to the friends afterwards (Play/LobbyModel.swift). */
export type LobbyGame = "mosh" | "duel" | "jigsaw" | "poet";

export const lobbyGames: readonly LobbyGame[] = ["mosh", "duel", "jigsaw", "poet"];

/** The name on the tile: «جورچین» is the short name of «جورچین بیت». */
export const lobbyTitle = (game: LobbyGame): string => (game === "mosh" ? "مشاعره" : game === "duel" ? "رودررو" : game === "jigsaw" ? "جورچین" : "حدس شاعر");

export const challengeOf = (game: LobbyGame): ChallengeGame | undefined => (game === "jigsaw" || game === "poet" ? game : undefined);

/** The time for each turn is only a choice in مشاعره. */
export const hasTurnTime = (game: LobbyGame): boolean => game === "mosh";

/** What opens the lobby: the game chosen first and, from a chat, the friend to invite. */
export type LobbyStart = { game?: LobbyGame; friend?: PersonShort };

/** What «بساز و دعوت کن» does. */
export type Plan =
  /** A game that waits for the friend: made on the server with the invitations. */
  | { kind: "friendGame"; game: GameKind; turnSeconds?: number; invite: string[] }
  /** A challenge: the player plays the round first, then it goes to these friends. */
  | { kind: "challenge"; game: ChallengeGame; invite: string[] };

export const turnChoices = [30, 120, 86_400] as const;
/** The server takes up to five invitations. */
export const maxInvites = 5;
/** The friends in the row before «بیشتر». */
export const shownFriends = 3;

/** Sends a chat text to a username; returns the line to show when it failed. */
export type SendText = (text: string, username: string) => Promise<string | undefined>;

type LobbyApi = Pick<Api, "friends">;

/** The lobby (GameLobby): the game, the turn time, who to invite. What it makes is a `Plan`. The state is a counter that grows with every change. */
export class LobbyModel extends Store<number> {
  private chosenGame: LobbyGame;
  private seconds = 86_400;
  private picked: string[];
  /** The game made for the link or the button; the second tap uses it instead of making another. */
  private madeGame?: FriendGame;
  /** Who the server sent an invitation to when the game was made, and who got the link as a chat message since. */
  private invited = new Set<string>();
  /** The game being made: a second tap (the link, then the button) waits for it instead of making another. */
  private creating?: Promise<GameCreated>;
  /** Which settings a game was made for: a game made for earlier settings is dropped when it comes back. */
  private generation = 0;
  /** Who could not be invited when it was made: «سارا» takes invitations only from friends. */
  private skipped: GameCreated["skipped"] = [];
  /** The line a chat invitation failed with, by username; gone when it goes on a later try. */
  private lateFailures = new Map<string, string>();
  private friends: PersonShort[] = [];
  private extras: PersonShort[] = [];
  private readonly start?: PersonShort;

  constructor(
    start: LobbyStart,
    private readonly api: LobbyApi,
  ) {
    super(0);
    this.chosenGame = start.game ?? "mosh";
    this.start = start.friend;
    this.picked = start.friend ? [start.friend.username] : [];
  }

  get game(): LobbyGame {
    return this.chosenGame;
  }

  set game(game: LobbyGame) {
    if (game === this.chosenGame) return;
    this.chosenGame = game;
    this.discardMade();
  }

  get turnSeconds(): number {
    return this.seconds;
  }

  set turnSeconds(seconds: number) {
    if (seconds === this.seconds) return;
    this.seconds = seconds;
    this.discardMade();
  }

  get selected(): readonly string[] {
    return this.picked;
  }

  get made(): FriendGame | undefined {
    return this.madeGame;
  }

  /** The faces in the row: the friend the lobby was opened for, then my friends (three), then the ones chosen with «بیشتر». */
  get people(): PersonShort[] {
    const seen = new Set<string>();
    // The friend the lobby was opened for is known by username only when it comes from an address: my friends say the name and face.
    const start = this.start && (this.friends.find((friend) => friend.username === this.start?.username) ?? this.start);
    return [...(start ? [start] : []), ...this.friends.slice(0, shownFriends), ...this.extras].filter((person) => !seen.has(person.username) && seen.add(person.username));
  }

  get plan(): Plan {
    const challenge = challengeOf(this.chosenGame);
    if (challenge) return { kind: "challenge", game: challenge, invite: [...this.picked] };
    return { kind: "friendGame", game: this.chosenGame === "duel" ? "duel" : "mosh", ...(this.chosenGame === "mosh" ? { turnSeconds: this.seconds } : {}), invite: [...this.picked] };
  }

  /** My friends who can play: «یه بیت» (`canPlay: false`) is not offered; a server that doesn't say counts as yes. */
  async loadFriends(): Promise<void> {
    try {
      const page = await this.api.friends();
      this.friends = page.items.filter((friend) => friend.canPlay !== false);
      this.changed();
    } catch {
      // The row stays as it is.
    }
  }

  /** Chooses or lets go of a person. False when five are chosen already. */
  toggle(username: string): boolean {
    const index = this.picked.indexOf(username);
    if (index >= 0) {
      this.picked = this.picked.filter((name) => name !== username);
    } else if (this.picked.length >= maxInvites) {
      return false;
    } else {
      this.picked = [...this.picked, username];
    }
    this.changed();
    return true;
  }

  /** A person found with «بیشتر». */
  add(person: Pick<FoundPerson, "username" | "displayName" | "avatar">): boolean {
    if (!this.people.some((one) => one.username === person.username)) this.extras = [...this.extras, { username: person.username, displayName: person.displayName, avatar: person.avatar }];
    this.changed();
    return this.picked.includes(person.username) || this.toggle(person.username);
  }

  // Making the game

  /** A game made for other settings is forgotten. The server has no way to end a game that waits (it expires by itself after a week, its code is free again then), so the old one is left; the next share or «بساز» makes a new one. */
  private discardMade(): void {
    this.madeGame = undefined;
    this.creating = undefined;
    this.invited = new Set();
    this.skipped = [];
    this.lateFailures = new Map();
    this.generation += 1;
    this.changed();
  }

  /**
   * The game that waits for the friend, made once: the link and the button share it, also when both are tapped before the server answers. Friends picked after it was
   * made get the link as a chat message (`sendText` returns a line when it failed). Undefined for a challenge (made after the round). Throws what the server said.
   */
  async makeGame(games: Pick<FriendGames, "create">, sendText: SendText = async () => undefined): Promise<FriendGame | undefined> {
    const { plan } = this;
    if (plan.kind !== "friendGame") return undefined;
    if (!this.madeGame) {
      const ticket = this.generation;
      const task = (this.creating ??= games.create(plan.game, plan.turnSeconds, plan.invite));
      let created: GameCreated;
      try {
        created = await task;
      } catch (error) {
        if (ticket === this.generation) this.creating = undefined; // a failed try is tried again next time
        throw error;
      }
      if (ticket !== this.generation) return created.game; // the settings changed meanwhile: this one is not the lobby's
      if (!this.madeGame) {
        this.madeGame = created.game;
        this.invited = new Set(created.invited);
        this.skipped = created.skipped;
      }
      this.creating = undefined;
      this.changed();
    }
    const game = this.madeGame;
    if (!game) return undefined;
    await this.inviteLate(game, sendText);
    return game;
  }

  /** Friends picked after the game was made were not in its invitations: they get the link in a chat. */
  private async inviteLate(game: FriendGame, sendText: SendText): Promise<void> {
    const text = playCopy.gameShare(gameName(this.chosenGame), `https://${playCopy.gameLink(game.code)}`);
    for (const username of this.picked) {
      if (this.invited.has(username) || this.skipped.some((one) => one.username === username)) continue;
      this.invited.add(username);
      const failure = await sendText(text, username);
      if (failure === undefined) {
        this.lateFailures.delete(username);
      } else {
        this.invited.delete(username); // tried again next time
        this.lateFailures.set(username, failure);
      }
    }
    this.changed();
  }

  /** The line for the people who were not invited, or whose chat invitation did not go (undefined when everybody was): the game is made anyway, and its link works. */
  get skippedLine(): string | undefined {
    const lines = [...this.skipped.flatMap((person) => playCopy.skipped(person) ?? []), ...this.picked.flatMap((name) => (this.lateFailures.has(name) ? [`${name}: ${this.lateFailures.get(name)}`] : []))];
    return lines.length === 0 ? undefined : lines.join("؛ ");
  }

  /** The link of the game made, or «yebeyt.com/g/…» before one is. */
  get linkText(): string {
    return this.madeGame ? playCopy.gameLink(this.madeGame.code) : "yebeyt.com/g/…";
  }

  private changed(): void {
    this.set(this.snapshot() + 1);
  }
}
