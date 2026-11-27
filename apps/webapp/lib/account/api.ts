import type { components } from "../api/schema";
import { feedbackLog } from "../feedback/log";
import { friendsApi } from "../friends/api";
import { messagesApi } from "../messages/api";
import { playApi } from "../play/api";
import { playStubHeaders } from "../play/debug";
import { fromWire, toWire, type DivanItem } from "../reader/divan";

export type User = components["schemas"]["User"];
export type ScoreRequest = components["schemas"]["ScoreRequest"];
export type DailyRequest = components["schemas"]["DailyRequest"];
export type Progress = components["schemas"]["Progress"];
export type RemoteStats = components["schemas"]["Stats"];
export type UsernameCheck = components["schemas"]["UsernameCheck"];
export type Avatar = NonNullable<components["schemas"]["Avatar"]>;
export type PrivacySettings = components["schemas"]["PrivacySettings"];
export type PrivacyPatch = components["schemas"]["PrivacyPatch"];
export type ReactionKind = "like" | "repost";
export type MyReactions = components["schemas"]["MyReactions"];

/**
 * What went wrong with a call to the server (Account/APIError.swift). `status` is the server's, 0 when it could not be reached; `code` is the
 * server's `{ "error": "<code>" }`, if it said one.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(code ?? `status ${status}`);
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** The server will never take this request as it is (a client error other than 401, 408 and 429): sending it again is useless, so a queue drops it. A 409 is the round already counted. */
  get isFinal(): boolean {
    return this.status >= 400 && this.status < 500 && ![401, 408, 429].includes(this.status);
  }

  /** The Persian line shown to the person. The codes themselves never reach the screen. */
  get persianMessage(): string {
    // Apple could not be reached to revoke its token: the account was kept (the one 502 the door passes on with its code).
    if (this.code === "apple_revoke_failed") return "الان نشد، یه کم دیگه دوباره امتحان کن";
    if (this.status === 0 || this.status === 502) return "اینترنت نیست؛ یه بار دیگه امتحان کن.";
    switch (this.code) {
      case "username_taken":
        return "قبلاً گرفته شده";
      case "username_too_short":
        return "حداقل ۳ حرف";
      case "username_too_long":
        return "حداکثر ۲۰ حرف";
      case "username_bad_chars":
        return "فقط حروف انگلیسی، عدد، «_» و «.»";
      case "username_reserved":
        return "این اسم رزرو شده";
      case "username_change_too_soon":
        return "هر ۳۰ روز یه بار می‌شه نام کاربری رو عوض کرد.";
      case "rate_limited":
        return "یکم صبر کن و دوباره امتحان کن.";
      case "invalid_token":
      case "unauthorized":
        return "ورود انجام نشد؛ دوباره امتحان کن.";
      default:
        return "یه مشکلی پیش اومد؛ یه بار دیگه امتحان کن.";
    }
  }
}

/** The line to show for anything thrown by a call. Its code is noted for a bug report (`feedbackLog`: codes only, never the message). */
export function messageOf(error: unknown): string {
  if (!(error instanceof ApiError)) return new ApiError(500).persianMessage;
  feedbackLog.record(error);
  return error.persianMessage;
}

type Fetch = typeof fetch;

/** One call to the server through the door: JSON in and out, a 204 answers nothing. */
export type Call = <Answer>(method: string, path: string, options?: { query?: Record<string, string>; body?: unknown }) => Promise<Answer>;

/**
 * The client of the server through the web app's own door (`/api`, which adds the session): JSON in and out, the field names as in `packages/api/openapi.json`
 * (the types are `lib/api/schema.d.ts`). `onSignedOut` is told when the server refused the session for good (the door has already tried to refresh it).
 */
export function createApi(onSignedOut: () => void = () => {}, send: Fetch = (...args) => fetch(...args)) {
  const call: Call = async <Answer>(method: string, path: string, options: { query?: Record<string, string>; body?: unknown } = {}): Promise<Answer> => {
    const query = options.query ? `?${new URLSearchParams(options.query)}` : "";
    let response: Response;
    try {
      response = await send(`/api${path}${query}`, {
        method,
        credentials: "same-origin",
        headers: { ...playStubHeaders(), ...(options.body === undefined ? {} : { "content-type": "application/json" }) },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch {
      throw new ApiError(0);
    }
    if (!response.ok) {
      const code = ((await response.json().catch(() => undefined)) as { error?: unknown } | undefined)?.error;
      if (response.status === 401) onSignedOut();
      throw new ApiError(response.status, typeof code === "string" ? code : undefined);
    }
    if (response.status === 204) return undefined as Answer;
    try {
      return (await response.json()) as Answer;
    } catch {
      throw new ApiError(502);
    }
  };

  const items = (wire: components["schemas"]["Divan"]): DivanItem[] => wire.items.flatMap((item) => fromWire(item) ?? []);

  return {
    checkUsername: (name: string) => call<UsernameCheck>("GET", "/v1/usernames/check", { query: { u: name } }),
    usernameSuggestions: async (base: string) => (await call<components["schemas"]["UsernameSuggestions"]>("GET", "/v1/usernames/suggestions", { query: { base } })).suggestions,
    setDisplayName: (displayName: string) => call<User>("PUT", "/v1/me/profile", { body: { displayName } }),
    setUsername: (username: string) => call<User>("PUT", "/v1/me/username", { body: { username } }),
    setAvatar: (avatar: Avatar) => call<User>("PUT", "/v1/me/avatar", { body: avatar }),
    /** «خبرهای یه بیت رو برام ایمیل کن»: the person's own choice; answers the user with it. */
    setNews: (optIn: boolean) => call<User>("PUT", "/v1/me/news", { body: { optIn } }),
    privacy: () => call<PrivacySettings>("GET", "/v1/me/privacy"),
    putPrivacy: (patch: PrivacyPatch) => call<PrivacySettings>("PUT", "/v1/me/privacy", { body: patch }),
    /** Deletes the account and everything stored for it. */
    deleteAccount: () => call<void>("DELETE", "/v1/me"),
    putProgress: (progress: Progress) => call<Progress>("PUT", "/v1/me/progress", { body: progress }).then((): void => {}),
    divan: async () => items(await call("GET", "/v1/me/divan")),
    /** Merges `items` (at most 2000) into the stored divan; answers the whole merged divan. */
    putDivan: async (divan: DivanItem[]) => items(await call("PUT", "/v1/me/divan", { body: { items: divan.map(toWire) } })),
    setReaction: (kind: ReactionKind, key: string, on: boolean) => call<unknown>(on ? "PUT" : "DELETE", `/v1/reactions/${kind}`, { query: { key } }).then((): void => {}),
    myReactions: (cursor?: string) => call<MyReactions>("GET", "/v1/me/reactions", cursor === undefined ? {} : { query: { cursor } }),
    postScore: (request: ScoreRequest) => call<unknown>("POST", "/v1/scores", { body: request }).then((): void => {}),
    postDaily: (request: DailyRequest) => call<unknown>("POST", "/v1/daily", { body: request }).then((): void => {}),
    stats: () => call<RemoteStats>("GET", "/v1/me/stats"),
    ...friendsApi(call),
    ...messagesApi(call),
    ...playApi(call),
  };
}

export type Api = ReturnType<typeof createApi>;
