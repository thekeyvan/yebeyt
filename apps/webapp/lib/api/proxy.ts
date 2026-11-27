/** The slug of a poet in the server's address: lower case letters, digits, «_» and «-». */
const slug = /^[a-z0-9_-]{1,40}$/;

/** The version of a picture, which makes its address new when the picture changes. */
const version = /^[A-Za-z0-9_-]{1,64}$/;

/** A username in the server's address: it starts with a letter, then letters, digits, «_» and «.» (never «.» or «..»). */
const username = /^[A-Za-z][A-Za-z0-9_.]{0,63}$/;

/** An id of the server (a chat, a message, a shared divan, one of its couplets: a UUID, here also what the debug server makes): letters, digits, «_» and «-». */
const id = /^[A-Za-z0-9_-]{1,64}$/;

/** Whether `text` can be a username at all: what a page may show of an address before the server has said anything. */
export const isUsername = (text: string): boolean => username.test(text);

/** A plain query value: short, no control characters. */
const plain = (value: string): boolean => value.length <= 400 && !/[\u0000-\u001f\u007f]/.test(value);

type Upload = {
  /** The media types the file may be sent as. */
  types: readonly string[];
  maxBytes: number;
};

type Rule = {
  methods: readonly string[];
  /** The path's parts after `/api`, as Next gives them (decoded), checked one by one; the path they stand for, or undefined. */
  path: (segments: string[]) => string | undefined;
  /** The query names passed on, each with how its value is checked (`plain` when not named). */
  query: Readonly<Record<string, (value: string) => boolean>>;
  /** Whether the session's access token goes with it: false for what a guest may ask; "optional" for what both may do (a result on a challenge is the account's, or a guest's with a name): the token goes when there is a session. */
  auth: boolean | "optional";
  /** The body is a file, not JSON: sent as it is, up to `maxBytes`, as one of `types`. */
  upload?: Upload;
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

/** `/v1/<prefix…>/<name><suffix…>`: the person (or the id) is one part of the path, checked against `pattern`. */
const named =
  (pattern: RegExp) =>
  (prefix: readonly string[], ...suffix: string[]) =>
  (segments: string[]): string | undefined => {
    const name = segments[prefix.length];
    const fits = segments.length === prefix.length + 1 + suffix.length && prefix.every((part, index) => segments[index] === part) && suffix.every((part, index) => segments[prefix.length + 1 + index] === part);
    return fits && name !== undefined && pattern.test(name) ? `/${[...prefix, name, ...suffix].join("/")}` : undefined;
  };

const person = named(username);
const identified = named(id);

/** `/v1/shared-divans/<id>/items/<item><suffix…>`: a couplet of a shared divan, both ids checked. */
const sharedItem =
  (...suffix: string[]) =>
  (segments: string[]): string | undefined => {
    const [first, second, divan, items, item, ...rest] = segments;
    const fits = first === "v1" && second === "shared-divans" && items === "items" && rest.length === suffix.length && suffix.every((part, index) => rest[index] === part);
    return fits && divan !== undefined && item !== undefined && id.test(divan) && id.test(item) ? `/${[first, second, divan, items, item, ...suffix].join("/")}` : undefined;
  };

/** The code of a challenge: four letters or digits (the server reads it in any case). */
const code = /^[0-9A-Za-z]{4}$/;

/** `/v1/challenges/<code><suffix…>`: the code is one part of the path, checked. */
const challenge = named(code);

/** The keys of the couplets whose counts are asked: up to 50 keys of 200 characters, comma separated (the server judges the keys). */
const keys = (value: string): boolean => value.length <= 50 * 201 && !/[\u0000-\u001f\u007f]/.test(value);

/** The id of a report: a UUID, as the server makes it. */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `/v1/feedback/<id>/<file>`: the file a report takes. */
const feedbackFile =
  (file: "screenshot" | "recording") =>
  (segments: string[]): string | undefined => {
    const [first, second, report, last, ...rest] = segments;
    return first === "v1" && second === "feedback" && report !== undefined && uuid.test(report) && last === file && rest.length === 0 ? `/v1/feedback/${report}/${file}` : undefined;
  };

const MB = 1024 * 1024;
/** What the server takes of each file of a report (`KINDS` in apps/server/src/routes/feedback.ts): the only bodies the door lets be bigger than a JSON body. */
export const maxScreenshotBytes = 3 * MB;
export const maxRecordingBytes = 25 * MB;

/**
 * The only paths the web app's `/api` route passes on, each with its methods: the poet pictures (W2, no session) and, from W4, what the account, the
 * divan, the reactions and the scores use, which go with the session's access token, from W5 the avatar, the privacy settings and the deletion
 * of the account (only `DELETE /v1/me`: reading the account is `/auth/session`'s), from W6 the friends: searching people, a person's profile, the friend
 * requests and friends, blocking and reporting, the leaderboard, the feed, the reactions' counts and the unread count (not unblocking, not the blocks list), and from W7
 * the messages: the chats, their messages and read marks, deleting a message, and the shared divans with their couplets and likes, and from W8 the games with friends
 * (making one, reading, joining, a move, giving up, my list; not joining by code) and the challenges (making one; reading one and leaving a result need no session: they go with it when there is one, and a guest's result has the name), and from W9 the feedback: a report (with the session when there is one) and its two files, a screenshot and a recording, which go with the upload token and no session and are the only bodies that may be more than 1 MB. The sign-in routes are not here (`/auth/*` makes them). Every part of the path is checked on its own and the address is built from the checked parts, so
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
  { methods: ["GET", "POST"], path: exact("v1", "conversations"), query: { cursor: plain }, auth: true },
  { methods: ["GET", "POST"], path: identified(["v1", "conversations"], "messages"), query: { before: plain }, auth: true },
  { methods: ["PUT"], path: identified(["v1", "conversations"], "read"), query: {}, auth: true },
  { methods: ["DELETE"], path: identified(["v1", "messages"]), query: {}, auth: true },
  { methods: ["GET", "POST"], path: exact("v1", "shared-divans"), query: { cursor: plain }, auth: true },
  { methods: ["GET", "POST"], path: identified(["v1", "shared-divans"], "items"), query: { by: (value) => ["all", "me", "them"].includes(value), cursor: plain }, auth: true },
  { methods: ["DELETE"], path: sharedItem(), query: {}, auth: true },
  { methods: ["PUT", "DELETE"], path: sharedItem("like"), query: {}, auth: true },
  { methods: ["POST"], path: exact("v1", "games"), query: {}, auth: true },
  { methods: ["GET"], path: identified(["v1", "games"]), query: {}, auth: true },
  { methods: ["POST"], path: identified(["v1", "games"], "join"), query: {}, auth: true },
  { methods: ["POST"], path: identified(["v1", "games"], "moves"), query: {}, auth: true },
  { methods: ["POST"], path: identified(["v1", "games"], "resign"), query: {}, auth: true },
  { methods: ["GET"], path: exact("v1", "me", "games"), query: {}, auth: true },
  { methods: ["POST"], path: exact("v1", "challenges"), query: {}, auth: true },
  { methods: ["GET"], path: challenge(["v1", "challenges"]), query: {}, auth: "optional" },
  { methods: ["POST"], path: challenge(["v1", "challenges"], "results"), query: {}, auth: "optional" },
  { methods: ["POST"], path: exact("v1", "feedback"), query: {}, auth: "optional" },
  { methods: ["PUT"], path: feedbackFile("screenshot"), query: {}, auth: false, upload: { types: ["image/jpeg", "image/png"], maxBytes: maxScreenshotBytes } },
  { methods: ["PUT"], path: feedbackFile("recording"), query: {}, auth: false, upload: { types: ["video/mp4"], maxBytes: maxRecordingBytes } },
];

/** Where a request goes on the server (path and query), whether it carries the session, and for a file what it may be; undefined for anything not allowed. */
export function upstreamRoute(method: string, segments: string[], search: URLSearchParams): { path: string; auth: boolean | "optional"; upload?: Upload } | undefined {
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
    return { path: text ? `${path}?${text}` : path, auth: rule.auth, ...(rule.upload ? { upload: rule.upload } : {}) };
  }
  return undefined;
}
