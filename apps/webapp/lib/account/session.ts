import { Store } from "../reader/store";
import { ApiError, type User } from "./api";

export type SessionState = {
  /** `loading` until the cookies have been asked about; `in` may still have no user (the server could not be reached). */
  status: "loading" | "guest" | "in";
  user?: User;
};

type Fetch = typeof fetch;

/** The parts of the session the syncs need. */
export type SessionLike = { readonly isSignedIn: boolean; readonly user: User | undefined; restore(): Promise<void> };

/**
 * Who is signed in (Account/Session.swift). The tokens are in cookies the page cannot read; the web app's own routes (`/auth/*`) start, refresh and
 * end the session, and this only knows the user they answer with.
 */
export class Session extends Store<SessionState> implements SessionLike {
  private restoring?: Promise<void>;

  constructor(private readonly send: Fetch = (...args) => fetch(...args)) {
    super({ status: "loading" });
  }

  get isSignedIn(): boolean {
    return this.snapshot().status === "in";
  }

  get user(): User | undefined {
    return this.snapshot().user;
  }

  /** On launch: who the cookies say is signed in, with the user. A browser that cannot reach the server stays signed in, without a user yet, and asks again when it is next asked. */
  restore(): Promise<void> {
    const { status, user } = this.snapshot();
    if (status === "guest" || user) return Promise.resolve();
    this.restoring ??= (async () => {
      try {
        const answer = (await (await this.send("/auth/session", { credentials: "same-origin" })).json()) as { signedIn?: boolean; user?: User };
        this.set(answer.signedIn ? { status: "in", user: answer.user } : { status: "guest" });
      } catch {
        if (status === "loading") this.set({ status: "guest" });
      } finally {
        this.restoring = undefined;
      }
    })();
    return this.restoring;
  }

  /** Sends what a provider gave to the web app's route for it, which keeps the tokens and answers with the user. */
  async signIn(provider: "apple" | "google", credential: Record<string, string | undefined>): Promise<User> {
    let response: Response;
    try {
      response = await this.send(`/auth/${provider}`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(credential) });
    } catch {
      throw new ApiError(0);
    }
    const answer = (await response.json().catch(() => undefined)) as { user?: User; error?: string } | undefined;
    if (!response.ok || !answer?.user) throw new ApiError(response.ok ? 502 : response.status, answer?.error);
    this.set({ status: "in", user: answer.user });
    return answer.user;
  }

  /** The user changed (a name or username was saved). */
  update(user: User): void {
    this.set({ ...this.snapshot(), user });
  }

  /** «خروج»: forgets the sign-in here at once, then tells the server (which may fail; the token expires anyway). */
  async signOut(): Promise<void> {
    this.clear();
    await this.send("/auth/logout", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => undefined);
  }

  /** The server refused the session for good. */
  clear = (): void => {
    this.set({ status: "guest" });
  };
}
