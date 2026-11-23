import { inArray } from "drizzle-orm";
import { randomInt } from "node:crypto";
import type { Db } from "./db/index.js";
import { users } from "./db/schema.js";

export type UsernameReason = "too_short" | "too_long" | "bad_chars" | "reserved" | "taken";

export const USERNAME_CHANGE_DAYS = 30;

const RESERVED = new Set([
  "yebeyt", "admin", "administrator", "support", "hello", "help", "api", "www", "root", "system",
  "moderator", "staff", "team", "official", "contact", "info", "security", "privacy", "terms",
  "null", "undefined", "me", "app", "ios", "android", "search",
]);

/** The stored form: lower-case. Names are compared case-insensitively. */
export const normalizeUsername = (u: string): string => u.trim().toLowerCase();

/** Checks the rules (not availability). Expects a normalized name. */
export function usernameProblem(u: string): Exclude<UsernameReason, "taken"> | null {
  if (!/^[a-z0-9_.]*$/.test(u)) return "bad_chars";
  if (u.length < 3) return "too_short";
  if (u.length > 20) return "too_long";
  if (!/^[a-z]/.test(u) || u.includes("..") || u.endsWith(".")) return "bad_chars";
  if (RESERVED.has(u)) return "reserved";
  return null;
}

export async function takenAmong(db: Db, names: string[]): Promise<Set<string>> {
  if (names.length === 0) return new Set();
  const rows = await db.select({ username: users.username }).from(users).where(inArray(users.username, names));
  return new Set(rows.flatMap((r) => (r.username ? [r.username] : [])));
}

export async function checkUsername(db: Db, raw: string): Promise<{ available: boolean; reason?: UsernameReason }> {
  const u = normalizeUsername(raw);
  const problem = usernameProblem(u);
  if (problem) return { available: false, reason: problem };
  if ((await takenAmong(db, [u])).has(u)) return { available: false, reason: "taken" };
  return { available: true };
}

/** Up to `limit` free, valid names built from a latin base by adding digits or an underscore. */
export async function suggestUsernames(db: Db, rawBase: string, limit = 5): Promise<string[]> {
  const base = normalizeUsername(rawBase)
    .replace(/[^a-z0-9_.]/g, "")
    .replace(/^[^a-z]+/, "")
    .replace(/\.{2,}/g, ".")
    .replace(/[.]+$/, "")
    .slice(0, 16);
  if (base.length === 0) return [];
  const digits = (n: number) => String(randomInt(10 ** (n - 1), 10 ** n));
  const candidates = new Set<string>([base]);
  for (let i = 0; candidates.size < 24 && i < 60; i++) {
    candidates.add(
      [`${base}${digits(2)}`, `${base}_${digits(2)}`, `${base}${digits(3)}`, `${base}_`, `${base}.${digits(2)}`, `${base}${digits(1)}`][i % 6]!,
    );
  }
  const valid = [...candidates].filter((c) => usernameProblem(c) === null);
  const taken = await takenAmong(db, valid);
  return valid.filter((c) => !taken.has(c)).slice(0, limit);
}
