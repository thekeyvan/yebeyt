import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { divanItems, feedback, identities, progress, scoreEvents, sessions, users } from "../src/db/schema.js";
import { MERGED_TABLES, BLOCKING_TABLES, IGNORED_TABLES } from "../src/mergeAccounts.js";
import { makeHarness, NONCE, type Harness } from "./helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});

type Session = Awaited<ReturnType<Harness["signIn"]>>;

/** A Google sign-in. An address that is not @gmail.com gets the Workspace claim `hd` (the only kind Google vouches for), unless `hd` is false. */
const google = async (sub: string, email?: string, verified: unknown = true, hd?: string | false) => {
  const domain = email?.split("@")[1]?.toLowerCase();
  const workspace = hd === undefined ? (domain && domain !== "gmail.com" ? domain : undefined) : hd || undefined;
  const claims = email === undefined ? {} : { email, email_verified: verified, ...(workspace ? { hd: workspace } : {}) };
  const res = await h.request("/v1/auth/google", { method: "POST", json: { idToken: await h.googleToken(sub, {}, claims) } });
  expect(res.status).toBe(200);
  return (await res.json()) as Session;
};

const apple = async (sub: string, claims: Record<string, unknown> = {}, code?: string) => {
  const res = await h.request("/v1/auth/apple", {
    method: "POST",
    json: { identityToken: await h.appleToken(sub, claims), nonce: NONCE, ...(code ? { authorizationCode: code } : {}) },
  });
  expect(res.status).toBe(200);
  return (await res.json()) as Session;
};

const verified = (email: string) => ({ email, email_verified: "true", is_private_email: "false" });
const RELAY = "abc123@privaterelay.appleid.com";
const relay = { email: RELAY, email_verified: "true", is_private_email: "true" };

const setUsername = async (s: Session, username: string) => {
  const res = await h.request("/v1/me/username", { method: "PUT", token: s.accessToken, json: { username } });
  expect(res.status).toBe(200);
};

const json = async <T = Record<string, unknown>>(res: Response | Promise<Response>) => (await res).json() as Promise<T>;
const emailOf = async (userId: string) => (await h.db.select().from(identities).where(eq(identities.userId, userId))).map((i) => i.email);
const userCount = async () => (await h.db.select().from(users).where(eq(users.isHouse, false))).length;
const identitiesOf = (userId: string) => h.db.select().from(identities).where(eq(identities.userId, userId));
const rowsOf = async (table: string) => ((await h.db.execute(sql.raw(`select count(*)::int as n from ${table}`))) as unknown as { rows: { n: number }[] }).rows[0]!.n;

describe("one account per verified email", () => {
  it("Google then Apple with the same email is one user with two identities", async () => {
    const g = await google("g1", "Ali@Example.com");
    const a = await apple("a1", verified("ali@example.com"));
    expect(a.user.id).toBe(g.user.id);
    expect(a.user.providers).toEqual(["apple", "google"]);
    expect(await userCount()).toBe(1);
    expect(await identitiesOf(g.user.id)).toHaveLength(2);
  });

  it("Apple then Google, the other way round, and the same sign-in again", async () => {
    const a = await apple("a1", { email: "ali@example.com", email_verified: true });
    const g = await google("g1", "ali@example.com");
    expect(g.user.id).toBe(a.user.id);
    expect((await google("g1", "ali@example.com")).user.id).toBe(a.user.id);
    expect((await apple("a1", { email: "ali@example.com", email_verified: true })).user.id).toBe(a.user.id);
    expect(await userCount()).toBe(1);
    expect(await identitiesOf(a.user.id)).toHaveLength(2);
  });

  it("matches the email whatever its case", async () => {
    const g = await google("g1", "ALI@EXAMPLE.COM");
    expect((await apple("a1", verified("  ali@Example.com"))).user.id).toBe(g.user.id);
  });

  it("an Apple private relay address is stored but never matches a Google address", async () => {
    const g = await google("g1", "ali@example.com");
    const a = await apple("a1", relay);
    expect(a.user.id).not.toBe(g.user.id);
    expect(await userCount()).toBe(2);
    expect(await emailOf(a.user.id)).toEqual([RELAY]);
  });

  it("an unverified Google email never matches", async () => {
    const a = await apple("a1", verified("ali@example.com"));
    const g = await google("g1", "ali@example.com", false);
    expect(g.user.id).not.toBe(a.user.id);
    expect(await userCount()).toBe(2);
    expect(await emailOf(g.user.id)).toEqual([null]);
  });

  it("a different email is a different account; no email is a new account as before", async () => {
    const a = await google("g1", "ali@example.com");
    expect((await google("g2", "sara@example.com")).user.id).not.toBe(a.user.id);
    expect((await google("g3")).user.id).not.toBe(a.user.id);
    expect(await userCount()).toBe(3);
  });

  it("stores the email lower-cased and trimmed, only when verified, and updates it on every sign-in", async () => {
    const g = await google("g1", "  Ali@Example.COM ");
    expect(await emailOf(g.user.id)).toEqual(["ali@example.com"]);
    await google("g1", "new@example.com");
    expect(await emailOf(g.user.id)).toEqual(["new@example.com"]);
    const u = await google("g2", "unverified@example.com", false);
    expect(await emailOf(u.user.id)).toEqual([null]);
    expect(await emailOf((await apple("a9", { email: "x@example.com", email_verified: "false" })).user.id)).toEqual([null]);
    expect(await emailOf((await apple("a8", { email: "Y@Example.com", email_verified: true })).user.id)).toEqual(["y@example.com"]);
  });

  it("a sign-in without an email does not erase the stored one", async () => {
    const g = await google("g1", "ali@example.com");
    await google("g1");
    expect(await emailOf(g.user.id)).toEqual(["ali@example.com"]);
    expect((await apple("a1", verified("ali@example.com"))).user.id).toBe(g.user.id);
  });

  it("never logs the email, and never puts it in a response other than the person's own", async () => {
    const email = "private.person@example.com";
    const g = await google("g1", email);
    await apple("a1", verified(email), "code");
    await h.request("/v1/me/username", { method: "PUT", token: g.accessToken, json: { username: "pp" } });
    const other = await h.signUp("other");
    await h.request("/v1/me/progress", { method: "PUT", token: other.token, json: { points: 1, streakDays: 0, streakLastDate: null, bestByGame: {} } });
    expect(h.logs.join("\n")).not.toContain("private.person");
    const seenByOthers = await Promise.all(
      ["/v1/users/pp", "/v1/users/search?q=pp", "/v1/leaderboard/global", "/v1/leaderboard/league"].map(async (path) => (await h.request(path, { token: other.token })).text()),
    );
    expect(seenByOthers.join("\n")).not.toContain("private.person");
  });

  it("concurrent first sign-ins of the same identity make one user and one identity", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => google("g1", "ali@example.com")));
    expect(new Set(results.map((r) => r.user.id)).size).toBe(1);
    expect(await userCount()).toBe(1);
    expect(await rowsOf("identities")).toBe(1);
  });

  it("concurrent first sign-ins of two methods with one email make one account", async () => {
    const results = await Promise.all([google("g1", "ali@example.com"), apple("a1", verified("ali@example.com")), google("g1", "ali@example.com"), apple("a1", verified("ali@example.com"))]);
    expect(new Set(results.map((r) => r.user.id)).size).toBe(1);
    expect(await userCount()).toBe(1);
    expect(await rowsOf("identities")).toBe(2);
  });

  it("the advisory lock on an email works in the test database and never blocks different emails", async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => (i % 2 === 0 ? apple(`a${i}`, verified(`person${i % 3}@gmail.com`)) : google(`g${i}`, `person${i % 3}@gmail.com`))),
    );
    expect(new Set(results.map((r) => r.user.id)).size).toBe(3);
  });

  it("concurrent sign-ins of an empty account's identity move it once", async () => {
    const real = await google("g1", "ali@example.com");
    await setUsername(real, "ali");
    await apple("a1", {});
    const results = await Promise.all(Array.from({ length: 5 }, () => apple("a1", verified("ali@example.com"))));
    expect(new Set(results.map((r) => r.user.id))).toEqual(new Set([real.user.id]));
    expect(await userCount()).toBe(1);
    expect(await rowsOf("identities")).toBe(2);
  });
});

describe("a provider's second account with one address is not the same person", () => {
  it("a second Google account with the same Workspace address makes a new user, but Apple still joins the first", async () => {
    const first = await google("g1", "ali@corp.example");
    const recycled = await google("g2", "ali@corp.example");
    expect(recycled.user.id).not.toBe(first.user.id);
    expect(await userCount()).toBe(2);
    expect((await apple("a1", verified("ali@corp.example"))).user.id).toBe(first.user.id);
    expect(await userCount()).toBe(2);
  });

  it("an empty Google account is not merged into the account that already has a Google sign-in", async () => {
    const real = await google("g1", "ali@corp.example");
    await setUsername(real, "ali");
    const empty = await google("g2", "other@corp.example");
    await h.db.update(identities).set({ email: "ali@corp.example" }).where(eq(identities.subject, "g2"));
    const again = await google("g2", "ali@corp.example");
    expect(again.user.id).toBe(empty.user.id);
    expect(await userCount()).toBe(2);
  });

  it("an empty account with Apple and Google is not merged into one that has Google", async () => {
    const real = await google("g1", "ali@corp.example");
    await setUsername(real, "ali");
    const empty = await google("g2", "other@corp.example");
    const orphan = await apple("a1", {});
    await h.db.update(identities).set({ userId: empty.user.id }).where(eq(identities.subject, "a1"));
    await h.db.delete(users).where(eq(users.id, orphan.user.id));
    const again = await apple("a1", verified("ali@corp.example"));
    expect(again.user.id).toBe(empty.user.id);
    expect(await userCount()).toBe(2);
    expect(await identitiesOf(empty.user.id)).toHaveLength(2);
  });
});

describe("only an address Google vouches for joins an account", () => {
  it("a Google address that is not @gmail.com and has no hd is stored but never links, in either direction", async () => {
    const g = await google("g1", "ali@example.com", true, false);
    expect(await emailOf(g.user.id)).toEqual(["ali@example.com"]);
    const a = await apple("a1", verified("ali@example.com"));
    expect(a.user.id).not.toBe(g.user.id);
    const g2 = await google("g2", "sara@example.com", true, false);
    const a2 = await apple("a2", verified("sara@example.com"));
    expect(a2.user.id).not.toBe(g2.user.id);
    expect(await userCount()).toBe(4);
  });

  it("@gmail.com links without hd, and a Workspace address links with it", async () => {
    const gmail = await google("g1", "Ali@gmail.com", true, false);
    expect((await apple("a1", verified("ali@gmail.com"))).user.id).toBe(gmail.user.id);
    const work = await google("g2", "sara@corp.example", true, "corp.example");
    expect((await apple("a2", verified("sara@corp.example"))).user.id).toBe(work.user.id);
    expect(await userCount()).toBe(2);
  });

  it("an empty account does not move on an address Google does not vouch for", async () => {
    const real = await apple("a1", verified("ali@example.com"));
    await setUsername(real, "ali");
    const empty = await google("g1", undefined);
    const again = await google("g1", "ali@example.com", true, false);
    expect(again.user.id).toBe(empty.user.id);
    expect(await userCount()).toBe(2);
  });
});

describe("an account still at the username step", () => {
  /** The owner's case: the Apple account was left without a username; the Google one has one. */
  const ownersCase = async () => {
    const real = await google("g1", "ali@example.com");
    await setUsername(real, "ali");
    const empty = await apple("a1", {}, "code"); // an Apple account that was made before emails were kept
    expect(empty.user.id).not.toBe(real.user.id);
    return { real, empty };
  };

  it("moves its identity to the account with a username, deletes the empty one and revokes its sessions", async () => {
    h.fetchMock.mockResolvedValueOnce(Response.json({ refresh_token: "apple-refresh-1" }));
    const real = await google("g1", "ali@example.com");
    await setUsername(real, "ali");
    const empty = await apple("a1", {}, "code");
    expect(empty.user.id).not.toBe(real.user.id);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);

    const again = await apple("a1", verified("ali@example.com"));
    expect(again.user.id).toBe(real.user.id);
    expect(again.user.username).toBe("ali");
    expect(await h.db.select().from(users).where(eq(users.id, empty.user.id))).toHaveLength(0);
    expect(await userCount()).toBe(1);
    expect((await identitiesOf(real.user.id)).map((i) => i.provider).sort()).toEqual(["apple", "google"]);
    expect(await h.db.select().from(sessions).where(eq(sessions.userId, empty.user.id))).toHaveLength(0);
    expect((await h.request("/v1/me", { token: empty.accessToken })).status).toBe(401);
    expect((await h.request("/v1/auth/refresh", { method: "POST", json: { refreshToken: empty.refreshToken } })).status).toBe(401);
  });

  it("carries its progress, divan, privacy settings, name and face over to the real account", async () => {
    const { real, empty } = await ownersCase();
    const put = (token: string, path: string, json: unknown) => h.request(path, { method: "PUT", token, json });
    await put(real.accessToken, "/v1/me/progress", { points: 50, streakDays: 7, streakLastDate: "2026-05-30", bestByGame: { poet: 10 } });
    await put(real.accessToken, "/v1/me/divan", { items: [{ key: "/a#0", keptAt: "2026-06-01T10:00:00.000Z" }, { key: "/shared#1", keptAt: "2026-06-01T10:00:00.000Z" }] });
    await put(empty.accessToken, "/v1/me/progress", { points: 30, streakDays: 9, streakLastDate: "2026-06-01", bestByGame: { poet: 40, misra: 5 } });
    await put(empty.accessToken, "/v1/me/divan", {
      items: [{ key: "/b#0", keptAt: "2026-06-01T11:00:00.000Z" }, { key: "/shared#1", removedAt: "2026-06-01T12:00:00.000Z" }],
    });
    await put(empty.accessToken, "/v1/me/privacy", { keptVisibility: "me" });
    await put(empty.accessToken, "/v1/me/profile", { displayName: "Ali" });

    await apple("a1", verified("ali@example.com"));

    const [p] = await h.db.select().from(progress).where(eq(progress.userId, real.user.id));
    expect(p).toMatchObject({ points: 50, streakDays: 9, streakLastDate: "2026-06-01", bestByGame: { poet: 40, misra: 5 } });
    const items = await h.db.select().from(divanItems).where(eq(divanItems.userId, real.user.id));
    expect(items.map((i) => i.key).sort()).toEqual(["/a#0", "/b#0", "/shared#1"]);
    expect(items.find((i) => i.key === "/shared#1")!.removedAt).toEqual(new Date("2026-06-01T12:00:00.000Z"));
    expect((await json(h.request("/v1/me/privacy", { token: real.accessToken }))).keptVisibility).toBe("me");
    expect((await json<{ displayName: string }>(h.request("/v1/me", { token: real.accessToken }))).displayName).toBe("Ali");
    expect(await rowsOf("progress")).toBe(1);
    expect(await userCount()).toBe(1);
  });

  it("keeps the real account's own privacy settings and name when both have them", async () => {
    const { real, empty } = await ownersCase();
    await h.request("/v1/me/privacy", { method: "PUT", token: real.accessToken, json: { keptVisibility: "friends", showOnline: false } });
    await h.request("/v1/me/privacy", { method: "PUT", token: empty.accessToken, json: { keptVisibility: "me", showOnline: true } });
    await h.request("/v1/me/profile", { method: "PUT", token: real.accessToken, json: { displayName: "Real" } });
    await h.request("/v1/me/profile", { method: "PUT", token: empty.accessToken, json: { displayName: "Other" } });
    await apple("a1", verified("ali@example.com"));
    const mine = await json(h.request("/v1/me/privacy", { token: real.accessToken }));
    expect(mine).toMatchObject({ keptVisibility: "friends", showOnline: false });
    expect((await json<{ displayName: string }>(h.request("/v1/me", { token: real.accessToken }))).displayName).toBe("Real");
  });

  it("keeps the feedback reports of the empty account, now on the real one", async () => {
    const { real, empty } = await ownersCase();
    const body = { type: "idea", text: "یک ایده", appVersion: "2.0.0", deviceModel: "iPhone17,1", osVersion: "26.0" };
    expect((await h.request("/v1/feedback", { method: "POST", token: empty.accessToken, json: body })).status).toBe(201);
    await apple("a1", verified("ali@example.com"));
    const rows = await h.db.select().from(feedback);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(real.user.id);
  });

  it("does not merge when the empty-looking account holds scores: both stay, the email is kept", async () => {
    const { real, empty } = await ownersCase();
    await h.db.insert(scoreEvents).values({ id: crypto.randomUUID(), userId: empty.user.id, game: "poet", points: 20, playedAt: h.clock.time, week: "2026-W23" });
    const again = await apple("a1", verified("ali@example.com"));
    expect(again.user.id).toBe(empty.user.id);
    expect(await userCount()).toBe(2);
    expect((await identitiesOf(real.user.id)).map((i) => i.provider)).toEqual(["google"]);
    expect((await identitiesOf(empty.user.id))[0]!.email).toBe("ali@example.com");
  });

  it("moves every identity of the empty account, not only the one that signed in", async () => {
    const real = await google("g1", "ali@example.com");
    await setUsername(real, "ali");
    // An account from before linking can have two Apple sign-ins (one per app, say); both move together.
    const empty = await apple("a2", {});
    const orphan = await apple("a1", {});
    await h.db.update(identities).set({ userId: empty.user.id }).where(eq(identities.subject, "a1"));
    await h.db.delete(users).where(eq(users.id, orphan.user.id));
    await apple("a1", verified("ali@example.com"));
    expect(await userCount()).toBe(1);
    expect(await identitiesOf(real.user.id)).toHaveLength(3);
  });

  it("an account that has a username is never moved by a matching email", async () => {
    const real = await google("g1", "ali@example.com");
    await setUsername(real, "ali");
    const other = await apple("a1", {});
    await setUsername(other, "ali2");
    const again = await apple("a1", verified("ali@example.com"));
    expect(again.user.id).toBe(other.user.id);
    expect(await userCount()).toBe(2);
    expect(await identitiesOf(real.user.id)).toHaveLength(1);
    expect(await identitiesOf(other.user.id)).toHaveLength(1);
  });

  it("two empty accounts are not merged with each other", async () => {
    const a = await google("g1", "ali@example.com");
    const b = await apple("a1", {});
    const again = await apple("a1", verified("ali@example.com"));
    expect(again.user.id).toBe(b.user.id);
    expect(a.user.id).not.toBe(b.user.id);
    expect(await userCount()).toBe(2);
  });
});

describe("accounts from before linking, with one email on several", () => {
  const sameEmail = () => h.db.update(identities).set({ email: "ali@example.com", emailLinkable: true });

  it("never merges two accounts that both have usernames", async () => {
    const one = await google("g1");
    await setUsername(one, "one");
    const two = await apple("a1");
    await setUsername(two, "two");
    await sameEmail();
    const again = await apple("a1", verified("ali@example.com"));
    expect(again.user.id).toBe(two.user.id);
    expect((await google("g1", "ali@example.com")).user.id).toBe(one.user.id);
    expect(await userCount()).toBe(2);
    expect(await identitiesOf(one.user.id)).toHaveLength(1);
    expect(await identitiesOf(two.user.id)).toHaveLength(1);
  });

  it("a new identity joins the one with a username, else the oldest", async () => {
    const old = await google("g1");
    const named = await google("g2");
    await setUsername(named, "named");
    const oldest = await google("g3");
    await sameEmail();
    await h.db.update(users).set({ createdAt: new Date("2026-01-01T00:00:00Z") }).where(eq(users.id, old.user.id));
    expect((await apple("a1", verified("ali@example.com"))).user.id).toBe(named.user.id);

    await setUsername(old, "old");
    await h.db.update(users).set({ createdAt: new Date("2026-01-02T00:00:00Z") }).where(eq(users.id, named.user.id));
    expect((await apple("a2", verified("ali@example.com"))).user.id).toBe(old.user.id);
    expect(oldest.user.id).not.toBe(old.user.id);
    expect(await userCount()).toBe(3);
  });
});

describe("deleting a linked account", () => {
  it("removes both identities and revokes Apple with the linked identity's token", async () => {
    const g = await google("g1", "ali@example.com");
    h.fetchMock.mockResolvedValueOnce(Response.json({ refresh_token: "apple-refresh-linked" }));
    await apple("a1", verified("ali@example.com"), "code");
    h.fetchMock.mockClear();
    h.fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    expect((await h.request("/v1/me", { method: "DELETE", token: g.accessToken })).status).toBe(204);
    expect(h.fetchMock).toHaveBeenCalledTimes(1);
    expect((h.fetchMock.mock.calls[0]![1]!.body as URLSearchParams).get("token")).toBe("apple-refresh-linked");
    expect(await rowsOf("identities")).toBe(0);
    expect(await userCount()).toBe(0);
  });

  it("revokes Apple with the token of an identity that moved out of an empty account", async () => {
    const real = await google("g1", "ali@example.com");
    await setUsername(real, "ali");
    h.fetchMock.mockResolvedValueOnce(Response.json({ refresh_token: "apple-refresh-moved" }));
    await apple("a1", {}, "code");
    const merged = await apple("a1", verified("ali@example.com"));
    expect(merged.user.id).toBe(real.user.id);
    h.fetchMock.mockClear();
    h.fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    expect((await h.request("/v1/me", { method: "DELETE", token: merged.accessToken })).status).toBe(204);
    expect((h.fetchMock.mock.calls[0]![1]!.body as URLSearchParams).get("token")).toBe("apple-refresh-moved");
    expect(await rowsOf("identities")).toBe(0);
  });
});

describe("the account's email and the news choice", () => {
  it("GET /v1/me returns the email and newsOptIn false by default; none without a verified email", async () => {
    const g = await google("g1", "Ali@Example.com");
    expect(await json(h.request("/v1/me", { token: g.accessToken }))).toMatchObject({ email: "ali@example.com", newsOptIn: false });
    expect(g.user).toMatchObject({ email: "ali@example.com", newsOptIn: false });
    const none = await google("g2");
    expect(await json(h.request("/v1/me", { token: none.accessToken }))).toMatchObject({ email: null, newsOptIn: false });
  });

  it("a linked account shows the email of its newest sign-in method that has one", async () => {
    const g = await google("g1", "ali@example.com");
    const a = await apple("a1", verified("ali@example.com"));
    await h.db.update(identities).set({ email: null }).where(eq(identities.subject, "a1"));
    expect(await json(h.request("/v1/me", { token: a.accessToken }))).toMatchObject({ email: "ali@example.com" });
    expect(a.user.id).toBe(g.user.id);
  });

  it("PUT /v1/me/news switches it on and off", async () => {
    const g = await google("g1", "ali@example.com");
    let token = g.accessToken;
    const put = (optIn: unknown) => h.request("/v1/me/news", { method: "PUT", token, json: { optIn } });
    const on = await put(true);
    expect(on.status).toBe(200);
    expect(await on.json()).toMatchObject({ newsOptIn: true, email: "ali@example.com" });
    const [stamp] = await h.db.select({ at: users.newsOptInAt }).from(users).where(eq(users.id, g.user.id));
    expect(stamp!.at).toEqual(h.clock.time);
    h.clock.time = new Date("2026-06-02T12:00:00Z");
    token = (await google("g1", "ali@example.com")).accessToken; // the access token of the first sign-in is a day old by now
    await put(true);
    expect((await h.db.select({ at: users.newsOptInAt }).from(users).where(eq(users.id, g.user.id)))[0]!.at).toEqual(new Date("2026-06-01T12:00:00Z")); // a repeat keeps the first time
    expect(await json(h.request("/v1/me", { token }))).toMatchObject({ newsOptIn: true });
    expect(await (await put(false)).json()).toMatchObject({ newsOptIn: false });
    expect((await h.db.select({ at: users.newsOptInAt }).from(users).where(eq(users.id, g.user.id)))[0]!.at).toBeNull();
    expect((await put("yes")).status).toBe(400);
    expect((await h.request("/v1/me/news", { method: "PUT", token, json: {} })).status).toBe(400);
  });

  it("PUT /v1/me/news needs a signed-in user", async () => {
    expect((await h.request("/v1/me/news", { method: "PUT", json: { optIn: true } })).status).toBe(401);
    expect((await h.request("/v1/me/news", { method: "PUT", token: "nope", json: { optIn: true } })).status).toBe(401);
  });

  it("deleting the account removes the email and the choice", async () => {
    const g = await google("g1", "ali@example.com");
    await h.request("/v1/me/news", { method: "PUT", token: g.accessToken, json: { optIn: true } });
    expect((await h.request("/v1/me", { method: "DELETE", token: g.accessToken })).status).toBe(204);
    const tables = ((await h.db.execute(sql`select table_name from information_schema.tables where table_schema = 'public'`)) as unknown as { rows: { table_name: string }[] }).rows;
    for (const { table_name } of tables) {
      const hit = ((await h.db.execute(sql.raw(`select count(*)::int as n from "${table_name}" t where t::text ilike '%ali@example.com%'`))) as unknown as { rows: { n: number }[] }).rows[0]!.n;
      expect(hit, table_name).toBe(0);
    }
    expect(await userCount()).toBe(0);
  });
});

describe("what the merge knows about", () => {
  it("covers every table that points at a user, so a new one cannot be lost by a merge", async () => {
    const rows = (
      (await h.db.execute(sql`
        select distinct c.conrelid::regclass::text as child
        from pg_constraint c
        where c.contype = 'f' and c.confrelid = 'public.users'::regclass`)) as unknown as { rows: { child: string }[] }
    ).rows.map((r) => r.child.replaceAll('"', ""));
    const known = [...MERGED_TABLES, ...BLOCKING_TABLES, ...IGNORED_TABLES].sort();
    expect([...new Set(rows)].sort()).toEqual([...new Set(known)].sort());
  });
});
