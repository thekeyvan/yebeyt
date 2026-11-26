/** The slug of a poet in the server's address: lower case letters, digits, «_» and «-». */
const slug = /^[a-z0-9_-]{1,40}$/;

/** The version of a picture, which makes its address new when the picture changes. */
const version = /^[A-Za-z0-9_-]{1,64}$/;

/** A username in the server's address: it starts with a letter, then letters, digits, «_» and «.» (never «.» or «..»). */
const username = /^[A-Za-z][A-Za-z0-9_.]{0,63}$/;

/** A plain query value: short, no control characters. */
const plain = (value: string): boolean => value.length <= 400 && !/[\u0000-\u001f\u007f]/.test(value);

type Rule = {
  methods: readonly string[];
  /** The path's parts after `/api`, as Next gives them (decoded), checked one by one; the path they stand for, or undefined. */
  path: (segments: string[]) => string | undefined;
  /** The query names passed on, each with how its value is checked (`plain` when not named). */
  query: Readonly<Record<string, (value: string) => boolean>>;
  /** Whether the session's access token goes with it: false for what a guest may ask. */
  auth: boolean;
};

const exact =
  (...parts: string[]) =>
  (segments: string[]): string | undefined =>
    segments.length === parts.length && parts.every((part, index) => segments[index] === part) ? `/${parts.join("/")}` : undefined;

const picture = (segments: string[]): string | undefined => {
  const [first, second, name, last, ...rest] = segments;
  return first === "v1" && second === "poets" && name !== undefined && slug.test(name) && last === "picture" && rest.length === 0 ? `/v1/poets/${name}/picture` : undefined;
};

const reaction = (segments: string[]): string | undefined => {
  const [first, second, kind, ...rest] = segments;
  return first === "v1" && second === "reactions" && (kind === "like" || kind === "repost") && rest.length === 0 ? `/v1/reactions/${kind}` : undefined;
};

/** `/v1/<prefix…>/<username><suffix…>`: the person is one checked part of the path. */
const person =
  (prefix: readonly string[], ...suffix: string[]) =>
  (segments: string[]): string | undefined => {
    const name = segments[prefix.length];
    const fits = segments.length === prefix.length + 1 + suffix.length && prefix.every((part, index) => segments[index] === part) && suffix.every((part, index) => segments[prefix.length + 1 + index] === part);
    return fits && name !== undefined && username.test(name) ? `/${[...prefix, name, ...suffix].join("/")}` : undefined;
  };

/** The keys of the couplets whose counts are asked: up to 50 keys of 200 characters, comma separated (the server judges the keys). */
const keys = (value: string): boolean => value.length <= 50 * 201 && !/[\u0000-\u001f\u007f]/.test(value);

/**
 * The only paths the web app's `/api` route passes on, each with its methods: the poet pictures (W2, no session) and, from W4, what the account, the
 * divan, the reactions and the scores use, which go with the session's access token, from W5 the avatar, the privacy settings and the deletion
 * of the account (only `DELETE /v1/me`: reading the account is `/auth/session`'s), and from W6 the friends: searching people, a person's profile, the friend
 * requests and friends, blocking and reporting, the leaderboard, the feed, the reactions' counts and the unread count (not unblocking, not the blocks list). The sign-in routes are not here (`/auth/*` makes them). Every part of the path is checked on its own and the address is built from the checked parts, so
 * nothing a visitor sends can make it point anywhere else on the server.
 */
const rules: readonly Rule[] = [
  { methods: ["GET"], path: exact("v1", "poets", "pictures"), query: { v: (value) => version.test(value) }, auth: false },
  { methods: ["GET"], path: picture, query: { v: (value) => version.test(value) }, auth: false },
  { methods: ["GET"], path: exact("v1", "usernames", "check"), query: { u: plain }, auth: true },
  { methods: ["GET"], path: exact("v1", "usernames", "suggestions"), query: { base: plain }, auth: true },
  { methods: ["PUT"], path: exact("v1", "me", "username"), query: {}, auth: true },
  { methods: ["PUT"], path: exact("v1", "me", "profile"), query: {}, auth: true },
  { methods: ["PUT"], path: exact("v1", "me", "avatar"), query: {}, auth: true },
  { methods: ["GET", "PUT"], path: exact("v1", "me", "privacy"), query: {}, auth: true },
  { methods: ["DELETE"], path: exact("v1", "me"), query: {}, auth: true },
  { methods: ["GET", "PUT"], path: exact("v1", "me", "divan"), query: {}, auth: true },
  { methods: ["GET"], path: exact("v1", "me", "reactions"), query: { cursor: plain }, auth: true },
  { methods: ["PUT", "DELETE"], path: reaction, query: { key: plain }, auth: true },
  { methods: ["POST"], path: exact("v1", "scores"), query: {}, auth: true },
  { methods: ["POST"], path: exact("v1", "daily"), query: {}, auth: true },
  { methods: ["GET"], path: exact("v1", "me", "stats"), query: {}, auth: true },
  { methods: ["PUT"], path: exact("v1", "me", "progress"), query: {}, auth: true },
  { methods: ["GET"], path: exact("v1", "users", "search"), query: { q: plain }, auth: true },
  { methods: ["GET"], path: person(["v1", "users"]), query: {}, auth: true },
  { methods: ["POST", "DELETE"], path: person(["v1", "friend-requests"]), query: {}, auth: true },
  { methods: ["POST"], path: person(["v1", "friend-requests"], "accept"), query: {}, auth: true },
  { methods: ["POST"], path: person(["v1", "friend-requests"], "reject"), query: {}, auth: true },
  { methods: ["DELETE"], path: person(["v1", "friends"]), query: {}, auth: true },
  { methods: ["GET"], path: exact("v1", "me", "friends"), query: { cursor: plain }, auth: true },
  { methods: ["GET"], path: exact("v1", "me", "friend-requests"), query: { direction: (value) => value === "incoming" || value === "outgoing", cursor: plain }, auth: true },
  { methods: ["GET"], path: exact("v1", "me", "unread"), query: {}, auth: true },
  { methods: ["PUT"], path: person(["v1", "blocks"]), query: {}, auth: true },
  { methods: ["POST"], path: exact("v1", "reports"), query: {}, auth: true },
  { methods: ["GET"], path: exact("v1", "leaderboard", "league"), query: {}, auth: true },
  { methods: ["GET"], path: exact("v1", "leaderboard", "friends"), query: {}, auth: true },
  { methods: ["GET"], path: exact("v1", "leaderboard", "global"), query: { cursor: plain }, auth: true },
  { methods: ["GET"], path: exact("v1", "feed"), query: { cursor: plain }, auth: true },
  { methods: ["GET"], path: exact("v1", "reactions", "counts"), query: { keys }, auth: true },
];

/** Where a request goes on the server (path and query), and whether it carries the session; undefined for anything not allowed. */
export function upstreamRoute(method: string, segments: string[], search: URLSearchParams): { path: string; auth: boolean } | undefined {
  for (const rule of rules) {
    if (!rule.methods.includes(method)) continue;
    const path = rule.path(segments);
    if (path === undefined) continue;
    const query = new URLSearchParams();
    for (const [name, check] of Object.entries(rule.query)) {
      const value = search.get(name);
      if (value !== null && check(value)) query.set(name, value);
    }
    const text = query.toString();
    return { path: text ? `${path}?${text}` : path, auth: rule.auth };
  }
  return undefined;
}
