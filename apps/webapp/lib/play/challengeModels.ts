import { ApiError, messageOf, type Api } from "../account/api";
import { coupletId, type GameCouplet, type GameDeck } from "../games/couplet";
import { canPlay } from "../games/jigsawQuestion";
import { nameOf } from "../games/kinds";
import { Store } from "../reader/store";
import { challengeItemCount, type ChallengeOffer } from "./challengeOffer";
import { playCopy, type Outcome } from "./copy";
import type { SendText } from "./lobbyModel";
import type { Challenge, ChallengeCreated } from "./models";

type SenderApi = Pick<Api, "createChallenge">;

export type SenderPhase = { kind: "idle" } | { kind: "creating" } | { kind: "created"; made: ChallengeCreated } | { kind: "failed"; line: string };
type SenderState = { phase: SenderPhase; /** The usernames that got the challenge as a chat message. */ sent: readonly string[] };

/**
 * Makes the challenge of a finished round on the server, once, and sends it to the friends: the picked ones as soon as it is made, others on request (`send`).
 * The link is shown on the card (ChallengeSend) (Play/ChallengeModels.swift `ChallengeSender`).
 */
export class ChallengeSender extends Store<SenderState> {
  /** `name` is mine, for the lines «نیلوفر تو رو به … چالش کشید». */
  constructor(
    readonly offer: ChallengeOffer,
    private readonly api: SenderApi,
    private readonly name: string,
    private readonly sendText: SendText,
  ) {
    super({ phase: { kind: "idle" }, sent: [] });
  }

  get created(): ChallengeCreated | undefined {
    const { phase } = this.snapshot();
    return phase.kind === "created" ? phase.made : undefined;
  }

  /** «yebeyt.com/c/7KQ2», or «yebeyt.com/c/····» while there is no code. */
  get linkText(): string {
    return playCopy.challengeLink(this.created?.code ?? "····");
  }

  /** «نیلوفر توی جورچین بیت ۸ از ۱۰ گرفت. تو چند می‌گیری؟» */
  get brag(): string {
    return playCopy.challengeBrag(this.name, nameOf(this.offer.game), this.offer.score);
  }

  /** What the messengers send. */
  get share(): { text: string; url: string } | undefined {
    const made = this.created;
    return made && { text: `${this.brag}\n${made.url}`, url: made.url };
  }

  /** Makes the challenge, once: a second call while it is being made or after it was, does nothing; after a failure it tries again. */
  async create(): Promise<void> {
    const { kind } = this.snapshot().phase;
    if (kind === "creating" || kind === "created") return;
    this.set({ ...this.snapshot(), phase: { kind: "creating" } });
    try {
      const made = await this.api.createChallenge(this.offer.game, this.offer.items, this.offer.score, this.offer.seconds);
      this.set({ ...this.snapshot(), phase: { kind: "created", made } });
      for (const username of this.offer.invite) await this.send(username);
    } catch (error) {
      this.set({ ...this.snapshot(), phase: { kind: "failed", line: messageOf(error) } });
    }
  }

  /** Sends the challenge to a friend as a chat message with the link. Returns the line to show when it failed. */
  async send(username: string): Promise<string | undefined> {
    const made = this.created;
    if (!made) return playCopy.challengePending;
    if (this.snapshot().sent.includes(username)) return undefined;
    const line = await this.sendText(playCopy.challengeInvite(this.name, nameOf(this.offer.game), made.code), username);
    if (line === undefined && !this.snapshot().sent.includes(username)) this.set({ ...this.snapshot(), sent: [...this.snapshot().sent, username] });
    return line;
  }
}

type AcceptApi = Pick<Api, "challenge" | "postChallengeResult">;

export type AcceptPhase = { kind: "loading" } | { kind: "ready"; challenge: Challenge } | { kind: "failed"; line: string };

/** The name a guest gives: trimmed, up to 30 characters (the server's limit); undefined when nothing is left. */
export function cleaned(name: string): string | undefined {
  const trimmed = [...name.trim()].slice(0, 30).join("");
  return trimmed === "" ? undefined : trimmed;
}

/** Who won: more than the maker's score wins, equal is a draw. */
export const outcomeOf = (mine: number, theirs: number): Outcome => (mine > theirs ? "won" : mine === theirs ? "draw" : "lost");

/**
 * The ten couplets of the challenge, found in the game deck in order. Undefined unless there are exactly ten and every one can be played here (a jigsaw needs a second
 * hemistich of 3 to 14 words; حدس شاعر a poet of the library): a round with other couplets in their place would not be the maker's.
 */
export function coupletsOf(challenge: Challenge, deck: GameDeck, poets: ReadonlySet<string>): GameCouplet[] | undefined {
  const byKey = new Map<string, GameCouplet>();
  for (const couplet of deck.couplets) if (!byKey.has(coupletId(couplet))) byKey.set(coupletId(couplet), couplet);
  const found = challenge.items.flatMap((key) => byKey.get(key) ?? []);
  if (found.length !== challengeItemCount || challenge.items.length !== found.length) return undefined;
  return (challenge.game === "jigsaw" ? found.every(canPlay) : found.every((couplet) => poets.has(couplet.poetSlug))) ? found : undefined;
}

/** A challenge opened by its code: loaded without an account, played with exactly its ten couplets, and answered with a result (Play/ChallengeModels.swift `ChallengeAccept`). */
export class ChallengeAccept extends Store<AcceptPhase> {
  /** `hasAccount`: someone is signed in with a username, so the result is theirs and no name is asked. */
  constructor(
    readonly code: string,
    private readonly api: AcceptApi,
    private readonly hasAccount: () => boolean,
  ) {
    super({ kind: "loading" });
  }

  get challenge(): Challenge | undefined {
    const phase = this.snapshot();
    return phase.kind === "ready" ? phase.challenge : undefined;
  }

  /** Without a username there is no account for a result: a name is asked at the end. */
  get asksName(): boolean {
    return !this.hasAccount();
  }

  async load(): Promise<void> {
    this.set({ kind: "loading" });
    try {
      this.set({ kind: "ready", challenge: await this.api.challenge(this.code) });
    } catch (error) {
      this.set({ kind: "failed", line: error instanceof ApiError && error.code === "not_found" ? playCopy.challengeGone : messageOf(error) });
    }
  }

  /**
   * Leaves my result: with my account, or as a guest with a name. Returns the line to show when it failed. A 409 means the result is there already (a second try, or the
   * maker's own challenge): that is done, not a failure.
   */
  async post(score: number, seconds: number, name?: string): Promise<string | undefined> {
    try {
      if (this.asksName) {
        const given = cleaned(name ?? "");
        if (given === undefined) return playCopy.nameNeeded;
        await this.api.postChallengeResult(this.code, score, seconds, given);
      } else {
        await this.api.postChallengeResult(this.code, score, seconds);
      }
      return undefined;
    } catch (error) {
      return error instanceof ApiError && error.code === "conflict" ? undefined : messageOf(error);
    }
  }
}
