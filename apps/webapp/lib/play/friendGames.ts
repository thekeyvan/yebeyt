import { Store } from "../reader/store";
import type { Api } from "../account/api";
import type { LiveEvent } from "../messages/liveEvents";
import { playCopy } from "./copy";
import { DuelState } from "./duelState";
import { duelAnswerFrame } from "./liveGameEvents";
import { MoshState } from "./moshState";
import type { MoshCandidate } from "./moshSuggestions";
import { otherThan, playerOf, type FriendGame, type GameCreated, type GameKind, type GameScore } from "./models";

type GamesApi = Pick<Api, "createGame" | "joinGame" | "game" | "myGames" | "playMove" | "resign">;

type Options = {
  api: GamesApi;
  /** My username, undefined while nobody is signed in. */
  me: () => string | undefined;
  now?: () => number;
};

/**
 * The games with friends of this browser: the games I know (by id), the live state of a رودررو, and the calls that play them. Live events and the lists meet
 * here, as in `MessagesCenter`; the screens only read it. The state is a counter that grows with every change (Play/FriendGames.swift).
 */
export class FriendGames extends Store<number> {
  private readonly games = new Map<string, FriendGame>();
  /** The ids of my games from the last read of `/v1/me/games`, newest first. */
  private mineIDs: string[] = [];
  private readonly duels = new Map<string, DuelState>();
  /** Sends a text over the live socket; false when it is not open. */
  sendLive?: (text: string) => boolean;
  /** A line to show for a moment over the tabs (a guest answered my challenge). */
  toast?: (line: string) => void;
  private readonly now: () => number;
  /** A counter that orders what happens here: a read (or a move's answer) that was asked for before a live event came is older than that event, and must not put the game back. */
  private tick = 0;
  private readonly touched = new Map<string, number>();

  constructor(private readonly options: Options) {
    super(0);
    this.now = options.now ?? Date.now;
  }

  get me(): string | undefined {
    return this.options.me();
  }

  game(id: string): FriendGame | undefined {
    return this.games.get(id);
  }

  /** My games from the last read, newest first. */
  get mine(): FriendGame[] {
    return this.mineIDs.flatMap((id) => this.games.get(id) ?? []);
  }

  /** The state of a مشاعره game as I see it; undefined when I am not signed in or the game is not known. */
  mosh(id: string): MoshState | undefined {
    const game = this.games.get(id);
    const me = this.me;
    return game && me ? new MoshState(game, me) : undefined;
  }

  /** The مشاعره game where it is my turn and the time runs out first; undefined when no turn is mine. */
  get urgentMosh(): MoshState | undefined {
    const me = this.me;
    if (!me) return undefined;
    const waiting = this.mine.filter((game) => game.kind === "mosh" && game.status === "active" && game.turn?.username === me);
    const first = waiting.sort((a, b) => Date.parse(a.turn!.deadline) - Date.parse(b.turn!.deadline))[0];
    return first && new MoshState(first, me);
  }

  // Reading

  async refreshMine(): Promise<void> {
    const ticket = this.nextTick();
    let list: FriendGame[];
    try {
      list = await this.options.api.myGames();
    } catch {
      return;
    }
    this.mineIDs = list.map((game) => game.id);
    for (const game of list) this.store(game, ticket);
    this.changed();
  }

  /** One game with its couplets or rounds. Nothing changes when it can't be read. */
  async load(id: string): Promise<FriendGame | undefined> {
    const ticket = this.nextTick();
    try {
      this.store(await this.options.api.game(id), ticket);
      this.changed();
    } catch {
      // What is known stays.
    }
    return this.games.get(id);
  }

  /** The socket (re)connected: events were missed, so what is open is read again. */
  async reconnected(): Promise<void> {
    if (!this.me) return;
    await this.refreshMine();
    for (const game of [...this.games.values()]) if (game.status !== "done") await this.load(game.id);
  }

  // Playing

  /** Makes a game and sends the invitations. Throws what the server said. */
  async create(kind: GameKind, turnSeconds: number | undefined, invite: readonly string[]): Promise<GameCreated> {
    const made = await this.options.api.createGame(kind, turnSeconds, invite);
    this.store(made.game);
    this.changed();
    return made;
  }

  /** «بزن بریم»: takes the seat by the game's id. Returns the line to show when it failed. */
  async join(id: string): Promise<string | undefined> {
    try {
      const ticket = this.nextTick();
      this.store(await this.options.api.joinGame(id), ticket);
      this.changed();
      return undefined;
    } catch (error) {
      return playCopy.gameError(error);
    }
  }

  /** Plays a couplet. Returns the line to show when the move was refused. */
  async play(candidate: MoshCandidate, id: string): Promise<string | undefined> {
    const letter = this.mosh(id)?.requiredLetter;
    try {
      const ticket = this.nextTick();
      this.store(await this.options.api.playMove(id, candidate.key, candidate.couplet.m1, candidate.couplet.m2), ticket);
      this.changed();
      return undefined;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "turn_over" || code === "not_your_turn" || code === "game_not_active") await this.load(id); // the game moved on
      return playCopy.moveError(error, letter);
    }
  }

  /** «کم آوردم»: the other player wins. */
  async resign(id: string): Promise<string | undefined> {
    try {
      const ticket = this.nextTick();
      this.store(await this.options.api.resign(id), ticket);
      this.changed();
      return undefined;
    } catch (error) {
      if ((error as { code?: string }).code === "game_not_active") await this.load(id);
      return playCopy.moveError(error);
    }
  }

  // رودررو

  /**
   * The live state of a duel: what the events have told so far, or a fresh one from the game. A game that is done (read after a reconnect, or opened from a list) has
   * its end from the game itself. Undefined while nobody has joined.
   */
  duel(id: string): DuelState | undefined {
    const me = this.me;
    const game = this.games.get(id);
    const other = me && game ? otherThan(game, me) : undefined;
    if (!me || !game || !other) return undefined;
    let state = this.duels.get(id);
    if (!state) this.duels.set(id, (state = new DuelState(id, me, other.username)));
    if (game.status === "done" && !state.isEnded && game.endReason) {
      const scores: GameScore[] = game.players.map(({ username, score }) => ({ username, score }));
      state.apply({ type: "game.ended", gameId: id, winner: game.winner, reason: game.endReason, scores, couplets: game.rounds }, this.now());
    }
    return state;
  }

  /** I choose an option: it is shown at once and sent over the socket. */
  answer(option: number, id: string): void {
    const state = this.duel(id);
    const round = state?.question?.round;
    if (!state || round === undefined || !state.choose(option)) return;
    this.changed();
    if (this.sendLive?.(duelAnswerFrame(id, round, option))) return;
    if (state.chosen === option && state.question?.round === round) {
      state.undoChoice(); // the answer did not leave the page: the choice is taken back and can be made again
      this.changed();
      this.toast?.(playCopy.answerNotSent);
    }
  }

  // Events

  handle(event: LiveEvent): void {
    switch (event.type) {
      case "game.started":
        this.touched.set(event.game.id, this.nextTick());
        this.store(event.game);
        break;
      case "game.move": {
        this.touched.set(event.gameId, this.nextTick());
        const game = this.games.get(event.gameId);
        if (!game) return;
        const moves = game.moves.some((move) => move.n === event.move.n) ? game.moves : [...game.moves, event.move];
        this.games.set(event.gameId, this.withScores({ ...game, moves }, event.scores));
        break;
      }
      case "game.turn": {
        this.touched.set(event.gameId, this.nextTick());
        const game = this.games.get(event.gameId);
        if (game) this.games.set(event.gameId, { ...game, turn: { username: event.username, deadline: event.deadline } });
        break;
      }
      case "game.ended": {
        this.touched.set(event.gameId, this.nextTick());
        const game = this.games.get(event.gameId);
        if (!game) return;
        const ended = this.withScores({ ...game, status: "done", winner: event.winner, endReason: event.reason, endedAt: new Date(this.now()).toISOString(), turn: null, rounds: event.couplets.length > 0 ? event.couplets : game.rounds }, event.scores);
        this.games.set(event.gameId, ended);
        this.applyToDuel(event, event.gameId);
        break;
      }
      case "duel.question":
        this.applyToDuel(event, event.question.gameId);
        break;
      case "duel.answered":
      case "duel.round":
        this.applyToDuel(event, event.gameId);
        break;
      case "challenge.result":
        if (event.result.username === null) this.toast?.(playCopy.liveResult(event.result));
        return;
      default:
        return;
    }
    this.changed();
  }

  private applyToDuel(event: Parameters<DuelState["apply"]>[0], id: string): void {
    this.duel(id)?.apply(event, this.now());
  }

  private withScores(game: FriendGame, scores: readonly GameScore[]): FriendGame {
    return { ...game, players: game.players.map((player) => ({ ...player, score: scores.find((score) => score.username === player.username)?.score ?? player.score })) };
  }

  /** Keeps what a list or an event brought, with the couplets and rounds the game already had when the new one has none. */
  private store(game: FriendGame, asked?: number): void {
    if (asked !== undefined && (this.touched.get(game.id) ?? 0) > asked) return; // an event came after this was asked: it is the older word
    const old = this.games.get(game.id);
    this.games.set(game.id, { ...game, moves: game.moves.length === 0 && old ? old.moves : game.moves, rounds: game.rounds.length === 0 && old ? old.rounds : game.rounds });
    const me = this.me;
    if (me && playerOf(game, me) && !this.mineIDs.includes(game.id)) this.mineIDs.unshift(game.id);
  }

  private nextTick(): number {
    this.tick += 1;
    return this.tick;
  }

  private changed(): void {
    this.set(this.snapshot() + 1);
  }

  /** Signed out: nothing of the account stays in memory. */
  reset(): void {
    this.games.clear();
    this.mineIDs = [];
    this.duels.clear();
    this.changed();
  }
}
