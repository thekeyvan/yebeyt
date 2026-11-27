import { ApiError, type User } from "../lib/account/api";
import type { SessionLike } from "../lib/account/session";

/** A user of the contract with only an id that matters. */
export const userOf = (id = "u1", username: string | null = "niloofar"): User => ({ id, username, displayName: null, avatar: null, usernameChangedAt: null, createdAt: "2026-11-20T08:00:00.000Z", providers: ["apple"], email: null, newsOptIn: false });

/** A session that is signed in as `id`, or a guest's. */
export function sessionOf(signedIn = true, id = "u1"): SessionLike & { user: User | undefined; isSignedIn: boolean } {
  return { isSignedIn: signedIn, user: signedIn ? userOf(id) : undefined, restore: async () => {} };
}

/** The ways a call to the server fails. */
export const offline = () => new ApiError(0);
export const refused = (status = 400, code = "invalid_request") => new ApiError(status, code);

/** Lets the work that is waiting on promises run. */
export const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
