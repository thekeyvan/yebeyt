import pg from "pg";
import { mergeStates, type SyncState } from "./merge.js";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

/** Creates the tables on first start. Safe to run on every boot. */
export async function migrate(): Promise<void> {
  await pool.query(`
    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      name text,
      email text,
      created_at timestamptz not null default now()
    );
    create table if not exists identities (
      provider text not null,
      subject text not null,
      user_id uuid not null references users(id) on delete cascade,
      email text,
      created_at timestamptz not null default now(),
      primary key (provider, subject)
    );
    create index if not exists identities_user on identities(user_id);
    alter table identities add column if not exists apple_refresh_token text;
    create index if not exists identities_email on identities(lower(email));
    create table if not exists user_state (
      user_id uuid primary key references users(id) on delete cascade,
      state jsonb not null,
      updated_at timestamptz not null default now()
    );
  `);
}

export interface User {
  id: string;
  name: string | null;
  email: string | null;
}

export interface IdentityRow {
  provider: string;
  email: string | null;
}

type Q = pg.PoolClient | pg.Pool;

async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

async function ownerOf(q: Q, provider: string, subject: string): Promise<string | null> {
  const r = await q.query<{ user_id: string }>("select user_id from identities where provider = $1 and subject = $2", [provider, subject]);
  return r.rows[0]?.user_id ?? null;
}

/**
 * Finds the account behind a sign-in. In order: the same provider identity; otherwise another
 * identity with the same verified email (so Google and Apple with one email are one account);
 * otherwise a new account.
 */
export async function signInUser(provider: string, subject: string, email?: string, name?: string): Promise<User> {
  return tx(async (c) => {
    let userId = await ownerOf(c, provider, subject);
    if (!userId && email) {
      const byEmail = await c.query<{ user_id: string }>(
        "select user_id from identities where lower(email) = lower($1) order by created_at limit 1",
        [email],
      );
      userId = byEmail.rows[0]?.user_id ?? null;
      if (userId) {
        await c.query("insert into identities (provider, subject, user_id, email) values ($1, $2, $3, $4)", [provider, subject, userId, email]);
      }
    }
    if (!userId) {
      const created = await c.query<{ id: string }>("insert into users (email, name) values ($1, $2) returning id", [email ?? null, name ?? null]);
      userId = created.rows[0].id;
      await c.query("insert into identities (provider, subject, user_id, email) values ($1, $2, $3, $4)", [provider, subject, userId, email ?? null]);
    } else if (email) {
      await c.query("update identities set email = $3 where provider = $1 and subject = $2", [provider, subject, email]);
    }
    // Apple sends the name only on the very first sign-in; keep what we have otherwise.
    await c.query("update users set email = coalesce(email, $2), name = coalesce(name, $3) where id = $1", [userId, email ?? null, name ?? null]);
    const user = await c.query<User>("select id, name, email from users where id = $1", [userId]);
    return user.rows[0];
  });
}

/**
 * Connects another sign-in to the current account. If that sign-in already belongs to a different
 * account, the two accounts are merged into the current one (identities move over, kept couplets and
 * history are combined, the other account is removed).
 */
export async function linkIdentity(userId: string, provider: string, subject: string, email?: string, name?: string): Promise<"linked" | "merged" | "already"> {
  return tx(async (c) => {
    const owner = await ownerOf(c, provider, subject);
    if (owner === userId) return "already";
    if (!owner) {
      await c.query("insert into identities (provider, subject, user_id, email) values ($1, $2, $3, $4)", [provider, subject, userId, email ?? null]);
      await c.query("update users set email = coalesce(email, $2), name = coalesce(name, $3) where id = $1", [userId, email ?? null, name ?? null]);
      return "linked";
    }
    // Merge `owner` into `userId`.
    const states = await c.query<{ user_id: string; state: SyncState }>("select user_id, state from user_state where user_id = any($1)", [[userId, owner]]);
    const mine = states.rows.find((r) => r.user_id === userId)?.state;
    const theirs = states.rows.find((r) => r.user_id === owner)?.state;
    if (theirs) {
      const merged = mine ? mergeStates(mine, theirs) : theirs;
      await c.query(
        `insert into user_state (user_id, state, updated_at) values ($1, $2, now())
         on conflict (user_id) do update set state = excluded.state, updated_at = now()`,
        [userId, JSON.stringify(merged)],
      );
    }
    await c.query("update identities set user_id = $1 where user_id = $2", [userId, owner]);
    const other = await c.query<User>("select id, name, email from users where id = $1", [owner]);
    await c.query("update users set email = coalesce(email, $2), name = coalesce(name, $3) where id = $1", [userId, other.rows[0]?.email ?? null, other.rows[0]?.name ?? null]);
    await c.query("delete from users where id = $1", [owner]);
    return "merged";
  });
}

/** Disconnects a sign-in method, as long as at least one other stays. Returns the removed rows. */
export async function unlinkIdentity(userId: string, provider: string): Promise<{ removed: number; appleTokens: string[] }> {
  return tx(async (c) => {
    const all = await c.query<{ provider: string; apple_refresh_token: string | null }>("select provider, apple_refresh_token from identities where user_id = $1", [userId]);
    const others = all.rows.filter((r) => r.provider !== provider).length;
    if (others === 0) return { removed: 0, appleTokens: [] };
    const tokens = all.rows.filter((r) => r.provider === provider && r.apple_refresh_token).map((r) => r.apple_refresh_token as string);
    const r = await c.query("delete from identities where user_id = $1 and provider = $2", [userId, provider]);
    return { removed: r.rowCount ?? 0, appleTokens: tokens };
  });
}

export async function listIdentities(userId: string): Promise<IdentityRow[]> {
  const r = await pool.query<IdentityRow>("select provider, email from identities where user_id = $1 order by created_at", [userId]);
  return r.rows;
}

export async function setAppleRefreshToken(subject: string, token: string): Promise<void> {
  await pool.query("update identities set apple_refresh_token = $2 where provider = 'apple' and subject = $1", [subject, token]);
}

export async function appleRefreshTokens(userId: string): Promise<string[]> {
  const r = await pool.query<{ t: string }>("select apple_refresh_token as t from identities where user_id = $1 and apple_refresh_token is not null", [userId]);
  return r.rows.map((x) => x.t);
}

export async function getUser(id: string): Promise<User | null> {
  const r = await pool.query<User>("select id, name, email from users where id = $1", [id]);
  return r.rows[0] ?? null;
}

export async function deleteUser(id: string): Promise<void> {
  await pool.query("delete from users where id = $1", [id]);
}

export async function getState(userId: string): Promise<{ state: unknown; updatedAt: string } | null> {
  const r = await pool.query<{ state: unknown; updated_at: Date }>("select state, updated_at from user_state where user_id = $1", [userId]);
  if (!r.rowCount) return null;
  return { state: r.rows[0].state, updatedAt: r.rows[0].updated_at.toISOString() };
}

export async function putState(userId: string, state: unknown): Promise<string> {
  const r = await pool.query<{ updated_at: Date }>(
    `insert into user_state (user_id, state, updated_at) values ($1, $2, now())
     on conflict (user_id) do update set state = excluded.state, updated_at = now()
     returning updated_at`,
    [userId, JSON.stringify(state)],
  );
  return r.rows[0].updated_at.toISOString();
}
