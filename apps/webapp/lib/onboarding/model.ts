import { Store, type KeyValueStorage } from "../reader/store";

/** The screens of onboarding, in order. The name is that of the phone's `-beytOnboarding` debug launch argument. */
export const onboardingSteps = ["welcome", "taste", "game", "account", "username", "friends"] as const;
export type OnboardingStep = (typeof onboardingSteps)[number];

/** «سلیقه · اولین بازی · حساب»; the other screens have no bar. */
export const barLabels = ["سلیقه", "اولین بازی", "حساب"] as const;

/** The place in the bar of a step. */
export function barIndex(step: OnboardingStep): number | undefined {
  return step === "taste" ? 0 : step === "game" ? 1 : step === "account" ? 2 : undefined;
}

export const onboardingDoneKey = "onboarding.done";

type State = { step?: OnboardingStep; gameWon: boolean };

/**
 * Where onboarding is (Onboarding/OnboardingModel.swift): welcome → taste → a 30-second game → account → username → friends. «رد شو» goes one step on; the
 * account step ends it. Onboarding is shown on the first visit to the home only, and only once.
 */
export class OnboardingModel extends Store<State> {
  constructor(
    start: OnboardingStep | undefined,
    private readonly storage: KeyValueStorage,
    gameWon = false,
  ) {
    super({ step: start, gameWon });
  }

  /** The first screen of a visit: the welcome until onboarding has been finished once. */
  static firstStep(storage: KeyValueStorage): OnboardingStep | undefined {
    return storage.getItem(onboardingDoneKey) === "true" ? undefined : "welcome";
  }

  get step(): OnboardingStep | undefined {
    return this.snapshot().step;
  }

  get gameWon(): boolean {
    return this.snapshot().gameWon;
  }

  get isRunning(): boolean {
    return this.step !== undefined;
  }

  /** «بزن بریم», «بعدی», «رد شو»: the next screen in line; the account step ends it. */
  next(): void {
    switch (this.step) {
      case "welcome":
        return this.go("taste");
      case "taste":
        return this.go("game");
      case "game":
        return this.go("account");
      case "username":
        return this.go("friends");
      case "account":
      case "friends":
        return this.finish();
    }
  }

  /** «از قبل حساب داری؟ وارد شو». */
  signIn(): void {
    if (this.step === "welcome") this.go("account");
  }

  /** The game ended; the account step follows. */
  gameEnded(won: boolean): void {
    if (this.step !== "game") return;
    this.set({ step: "account", gameWon: won });
  }

  /** Signed in on the account step: a new account picks its username, one that has it is done. */
  signedIn(needsUsername: boolean): void {
    if (this.step !== "account") return;
    this.storage.setItem(onboardingDoneKey, "true"); // there is an account now: a reload must not ask again
    if (needsUsername) this.go("username");
    else this.finish();
  }

  /** «فعلاً بدون حساب», «بریم خونه», «بعداً». */
  finish(): void {
    this.storage.setItem(onboardingDoneKey, "true");
    this.set({ ...this.snapshot(), step: undefined });
  }

  private go(step: OnboardingStep): void {
    this.set({ ...this.snapshot(), step });
  }
}

/**
 * The debug start (the phone's `-beytOnboarding`): `sessionStorage.beytOnboarding` is a step name, which starts there whatever was done before, or `first`, which
 * behaves as a release build (the welcome on the first visit only). A debug build without it shows no onboarding, so the other screens can be tested; a build
 * without the debug pages ignores it.
 */
export function debugStep(session: Pick<Storage, "getItem">, debugPages: boolean): OnboardingStep | "first" | undefined {
  const value = debugPages ? session.getItem("beytOnboarding") : null;
  return value === "first" ? "first" : onboardingSteps.find((step) => step === value);
}
