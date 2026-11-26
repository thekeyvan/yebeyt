import { ApiError, messageOf, type Api } from "./api";
import { normalizeUsername, problem, type UsernameProblem } from "./usernameRules";
import { Store } from "../reader/store";

export type AvailabilityState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "unavailable"; problem: UsernameProblem }
  /** The question could not be asked; the line says why. */
  | { kind: "failed"; message: string };

const known: readonly string[] = ["too_short", "too_long", "bad_chars", "reserved", "taken"];

type State = { text: string; state: AvailabilityState };

/**
 * The state of the username field (Account/UsernameAvailability.swift): the local rules answer at once, the server is asked 300 ms after the last keystroke
 * (so typing «niloofar» is one question, not eight). `own` is the user's current username: it is free for them.
 */
export class UsernameAvailability extends Store<State> {
  private timer?: ReturnType<typeof setTimeout>;
  private asked = 0;

  constructor(
    private readonly check: Api["checkUsername"],
    private readonly own?: string,
    private readonly debounceMs = 300,
  ) {
    super({ text: "", state: { kind: "idle" } });
  }

  get text(): string {
    return this.snapshot().text;
  }

  get state(): AvailabilityState {
    return this.snapshot().state;
  }

  /** The name as it would be saved. */
  get normalized(): string {
    return normalizeUsername(this.text);
  }

  get isAvailable(): boolean {
    return this.state.kind === "available";
  }

  setText(text: string): void {
    if (text === this.text) return;
    clearTimeout(this.timer);
    const turn = ++this.asked;
    const name = normalizeUsername(text);
    const found = name === "" ? undefined : problem(name);
    if (name === "") this.show(text, { kind: "idle" });
    else if (found) this.show(text, { kind: "unavailable", problem: found });
    else if (name === this.own) this.show(text, { kind: "available" });
    else {
      this.show(text, { kind: "checking" });
      this.timer = setTimeout(() => void this.ask(name, turn), this.debounceMs);
    }
  }

  private async ask(name: string, turn: number): Promise<void> {
    try {
      const answer = await this.check(name);
      if (turn !== this.asked) return; // a later keystroke has made this answer old
      const reason = answer.reason !== undefined && known.includes(answer.reason) ? answer.reason : "taken";
      this.show(this.text, answer.available ? { kind: "available" } : { kind: "unavailable", problem: reason });
    } catch (error) {
      if (turn === this.asked) this.show(this.text, { kind: "failed", message: error instanceof ApiError ? error.persianMessage : messageOf(error) });
    }
  }

  private show(text: string, state: AvailabilityState): void {
    this.set({ text, state });
  }
}
