import { problem } from "../account/usernameRules";
import type { Call } from "./bff";
import { friendsAnswer, World, type Me } from "./stubFriends";

// A server that answers for the debug sign-in (the phone's `-beytSignedIn 1`, which is answered on the phone): only in a dev build or one built with
// NEXT_PUBLIC_DEV_PAGES=1 (`lib/dev.ts`; the switch is baked in at build time, so a variable set on a running server cannot turn it on), a session whose
// tokens begin with «debug-» is answered here, in memory, and never reaches the real server. Any other build never asks it.

type Spec = { id: string; username: string | null; displayName: string | null; provider: "apple" | "google"; syncFails: boolean };

type Account = {
  spec: Spec;
  user: Record<string, unknown>;
  divan: Map<string, { key: string; keptAt?: string; removedAt?: string }>;
  reactions: Map<string, string>;
  rounds: Set<string>;
  points: number;
  progress: { points: number; streakDays: number; streakLastDate: string | null; bestByGame: Record<string, number> };
  privacy: Record<string, unknown>;
  world: World;
};

// On `globalThis`, so that the routes of the app, which may be built apart, share one set of accounts.
const accounts: Map<string, Account> = ((globalThis as { __beytStub?: Map<string, Account> }).__beytStub ??= new Map());
/** The accounts that were deleted: the real server knows no session of them any more. */
const deleted: Set<string> = ((globalThis as { __beytStubDeleted?: Set<string> }).__beytStubDeleted ??= new Set());

/** The server's defaults for the privacy settings (`PRIVACY_DEFAULTS` in apps/server/src/routes/privacy.ts). */
const privacyDefaults = { keptVisibility: "friends", dailyVisibility: "friends", showOnline: true, inGlobalLeaderboard: false, messagesFrom: "friends", gameInvitesFrom: "all", allowReposts: true };

/** Names the debug server says are taken. */
export const takenUsernames = ["sara", "sara.ghazal", "aryan", "hafez", "niloofar"];

const encode = (spec: Spec): string => Buffer.from(JSON.stringify(spec)).toString("base64url");

const isDebugToken = (token: unknown): token is string => typeof token === "string" && token.startsWith("debug-");

/** The session of a debug sign-in; the access token carries who it is, so the server needs no table of sessions. */
function debugSession(given: Partial<Spec>): Response {
  const spec: Spec = { id: crypto.randomUUID(), username: null, displayName: null, provider: "apple", syncFails: false, ...given };
  deleted.delete(spec.id); // signing in again after a deletion makes a new account
  return Response.json({ accessToken: `debug-access.${encode(spec)}`, refreshToken: `debug-refresh.${encode(spec)}`, user: accountOf(spec).user });
}

function accountOf(spec: Spec): Account {
  let account = accounts.get(spec.id);
  if (!account) {
    const user = { id: spec.id, username: spec.username, displayName: spec.displayName, avatar: null, usernameChangedAt: null, createdAt: "2026-11-20T08:00:00.000Z", providers: [spec.provider] };
    account = { spec, user, divan: new Map(), reactions: new Map(), rounds: new Set(), points: 0, progress: { points: 0, streakDays: 0, streakLastDate: null, bestByGame: {} }, privacy: { ...privacyDefaults }, world: new World() };
    accounts.set(spec.id, account);
  }
  return account;
}

const later = (a?: string, b?: string): string | undefined => (a === undefined ? b : b === undefined ? a : a > b ? a : b);
const error = (status: number, code: string) => Response.json({ error: code }, { status });
const specOf = (token: string): Spec => JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as Spec;

/** The refusals of the real server's rules for a username, in the codes it answers with. */
const usernameCodes = { too_short: "username_too_short", too_long: "username_too_long", bad_chars: "username_bad_chars", reserved: "username_reserved" } as const;

/**
 * The debug sign-in (the phone's `-beytSignedIn 1`): a sign-in with a fake provider token `debug-<base64url of {id, username, displayName, provider, syncFails}>`
 * (`id` makes it the same account on a later sign-in, `username` null: a new account that still has to choose one; `syncFails`: the divan is refused, for the sign-out warning) starts a session, and a call
 * with the tokens of one is answered here. Undefined for everything else, which goes to the real server.
 */
export function debugAnswer(call: Call): Response | undefined {
  const given = call.body ? (JSON.parse(call.body) as Record<string, unknown>) : {};
  const token = call.path === "/v1/auth/google" ? given.idToken : call.path === "/v1/auth/apple" ? given.identityToken : undefined;
  if (isDebugToken(token)) return debugSession(JSON.parse(Buffer.from(token.slice("debug-".length), "base64url").toString()));
  return isDebugToken(call.credential) ? stubAnswer(call) : undefined;
}

/** Answers `call` as the server would, for an account that signed in with the debug sign-in. */
function stubAnswer({ method, path, credential, body }: Call): Response {
  const url = new URL(path, "http://stub");
  const given = body ? (JSON.parse(body) as Record<string, any>) : {};
  const account = accountOf(specOf(credential ?? ""));
  const route = `${method} ${url.pathname}`;
  const { searchParams } = url;
  if (deleted.has(account.spec.id)) return error(401, "unauthorized");
  if (account.spec.syncFails && url.pathname === "/v1/me/divan") return error(503, "unavailable");

  switch (route) {
    case "POST /v1/auth/refresh":
      return Response.json({ accessToken: `debug-access.${encode(account.spec)}`, refreshToken: `debug-refresh.${encode(account.spec)}`, user: account.user });
    case "POST /v1/auth/logout":
      return new Response(null, { status: 204 });
    case "GET /v1/me":
      return Response.json(account.user);
    case "DELETE /v1/me":
      accounts.delete(account.spec.id);
      deleted.add(account.spec.id);
      return new Response(null, { status: 204 });
    case "PUT /v1/me/avatar":
      account.user = { ...account.user, avatar: given };
      return Response.json(account.user);
    case "GET /v1/me/privacy":
      return Response.json(account.privacy);
    case "PUT /v1/me/privacy":
      account.privacy = { ...account.privacy, ...given };
      return Response.json(account.privacy);
    case "PUT /v1/me/profile":
      account.user = { ...account.user, displayName: String(given.displayName ?? "").trim() };
      return Response.json(account.user);
    case "GET /v1/usernames/check": {
      const name = searchParams.get("u") ?? "";
      const reason = problem(name) ?? (takenUsernames.includes(name) ? "taken" : undefined);
      return Response.json(reason ? { available: false, reason } : { available: true });
    }
    case "GET /v1/usernames/suggestions": {
      const base = searchParams.get("base") ?? "beyt";
      return Response.json({ suggestions: [`${base}_`, `${base}.beyt`, `${base}42`].filter((name) => !takenUsernames.includes(name)) });
    }
    case "PUT /v1/me/username": {
      const name = String(given.username ?? "");
      const refused = problem(name);
      if (refused) return error(400, usernameCodes[refused]);
      if (takenUsernames.includes(name)) return error(409, "username_taken");
      account.user = { ...account.user, username: name, usernameChangedAt: new Date().toISOString() };
      return Response.json(account.user);
    }
    case "GET /v1/me/divan":
      return Response.json({ items: [...account.divan.values()] });
    case "PUT /v1/me/divan":
      for (const item of given.items as { key: string; keptAt?: string; removedAt?: string }[]) {
        const known = account.divan.get(item.key);
        const keptAt = later(known?.keptAt, item.keptAt);
        const removedAt = later(known?.removedAt, item.removedAt);
        account.divan.set(item.key, { key: item.key, ...(keptAt && { keptAt }), ...(removedAt && { removedAt }) });
      }
      return Response.json({ items: [...account.divan.values()] });
    case "PUT /v1/reactions/like":
    case "PUT /v1/reactions/repost":
    case "DELETE /v1/reactions/like":
    case "DELETE /v1/reactions/repost": {
      const id = `${url.pathname.split("/")[3]}|${searchParams.get("key")}`;
      if (method === "PUT") account.reactions.set(id, new Date().toISOString());
      else account.reactions.delete(id);
      return Response.json({ likes: 0, reposts: 0, likedByMe: false, repostedByMe: false });
    }
    case "GET /v1/me/reactions":
      return Response.json({ items: [...account.reactions].map(([id, at]) => ({ key: id.slice(id.indexOf("|") + 1), kind: id.slice(0, id.indexOf("|")), at })), nextCursor: null });
    case "POST /v1/scores":
      if (account.rounds.has(given.roundId)) return error(409, "conflict");
      account.rounds.add(given.roundId);
      account.points += Number(given.points) || 0;
      return Response.json({ week: "2026-W48", weekPoints: account.points });
    case "POST /v1/daily":
      return Response.json({ date: given.date, solved: given.solved, tries: given.tries });
    case "PUT /v1/me/progress": {
      const before = account.progress;
      account.progress = {
        points: Math.max(before.points, given.points),
        streakDays: Math.max(before.streakDays, given.streakDays),
        streakLastDate: [before.streakLastDate, given.streakLastDate].filter((day): day is string => day !== null).sort().at(-1) ?? null,
        bestByGame: Object.fromEntries([...new Set([...Object.keys(before.bestByGame), ...Object.keys(given.bestByGame)])].map((game) => [game, Math.max(before.bestByGame[game] ?? 0, given.bestByGame[game] ?? 0)])),
      };
      return Response.json(account.progress);
    }
    case "GET /v1/me/stats":
      return Response.json({ totalPoints: account.points, weekPoints: account.points, streakDays: account.progress.streakDays, league: { tier: 1 } });
    default:
      return friendsAnswer({ method, pathname: url.pathname, search: searchParams, given, world: account.world, me: account.user as Me, mine: new Set(account.reactions.keys()) }) ?? error(404, "not_found");
  }
}
