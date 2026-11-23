import { and, eq, gt, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { randomToken, sha256Hex } from "../crypto.js";
import type { Db } from "../db/index.js";
import { sessions } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError } from "../errors.js";

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000;
const REUSE_GRACE_MS = 10_000;
const ISSUER = "yebeyt";

type SessionDeps = Pick<Deps, "db" | "now" | "config">;
export type Tokens = { accessToken: string; refreshToken: string };

const secretKey = (deps: SessionDeps) => new TextEncoder().encode(deps.config.jwtSecret);

async function signAccessToken(deps: SessionDeps, userId: string): Promise<string> {
  const iat = Math.floor(deps.now().getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt(iat)
    .setExpirationTime(iat + ACCESS_TTL_SECONDS)
    .sign(secretKey(deps));
}

/** Returns the user id in a valid access token. */
export async function verifyAccessToken(deps: SessionDeps, token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, secretKey(deps), {
      issuer: ISSUER,
      algorithms: ["HS256"],
      currentDate: deps.now(),
      requiredClaims: ["sub", "exp"],
    });
    if (!payload.sub) throw new Error("no subject");
    return payload.sub;
  } catch {
    throw new ApiError(401, "unauthorized");
  }
}

const insertRefreshToken = async (db: Db, deps: SessionDeps, userId: string, familyId: string): Promise<string> => {
  const refreshToken = randomToken();
  await db.insert(sessions).values({
    userId,
    familyId,
    tokenHash: sha256Hex(refreshToken),
    expiresAt: new Date(deps.now().getTime() + REFRESH_TTL_MS),
  });
  return refreshToken;
};

/** Starts a refresh token in `familyId` (a new family for a new sign-in) and signs an access token. */
export async function issueSession(deps: SessionDeps, userId: string, familyId: string = randomUUID()): Promise<Tokens> {
  const refreshToken = await insertRefreshToken(deps.db, deps, userId, familyId);
  return { accessToken: await signAccessToken(deps, userId), refreshToken };
}

const revokeFamily = (deps: SessionDeps, familyId: string) =>
  deps.db.update(sessions).set({ revokedAt: deps.now() }).where(and(eq(sessions.familyId, familyId), isNull(sessions.revokedAt)));

const findByToken = async (deps: SessionDeps, refreshToken: string) =>
  (await deps.db.select().from(sessions).where(eq(sessions.tokenHash, sha256Hex(refreshToken))))[0];

/**
 * Swaps a refresh token for a new pair. A token works once: marking it used and issuing the next one
 * is a single transaction that only matches an unused, unrevoked, unexpired token, so of two parallel
 * uses exactly one wins.
 *
 * Showing a used token again means it may have leaked, so the whole family (every token from that
 * sign-in) is revoked. Exception: if the token was used less than REUSE_GRACE_MS ago the call is
 * refused (401) without revoking, because that is a client retrying or racing itself, not a thief.
 */
export async function rotateSession(deps: SessionDeps, refreshToken: string): Promise<Tokens & { userId: string }> {
  const row = await findByToken(deps, refreshToken);
  if (!row) throw new ApiError(401, "invalid_token");
  const now = deps.now();

  const next = await deps.db.transaction(async (tx) => {
    const claimed = await tx
      .update(sessions)
      .set({ usedAt: now })
      .where(and(eq(sessions.id, row.id), isNull(sessions.usedAt), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)))
      .returning({ id: sessions.id });
    if (claimed.length === 0) return null;
    return insertRefreshToken(tx as unknown as Db, deps, row.userId, row.familyId);
  });

  if (next === null) {
    const current = await findByToken(deps, refreshToken);
    const reused = current && !current.revokedAt && current.usedAt && current.expiresAt > now;
    if (reused && now.getTime() - current.usedAt!.getTime() >= REUSE_GRACE_MS) await revokeFamily(deps, row.familyId);
    throw new ApiError(401, "invalid_token");
  }
  return { accessToken: await signAccessToken(deps, row.userId), refreshToken: next, userId: row.userId };
}

/** Ends the sign-in the refresh token belongs to. Unknown tokens are ignored. */
export async function logoutSession(deps: SessionDeps, refreshToken: string): Promise<void> {
  const row = await findByToken(deps, refreshToken);
  if (row) await revokeFamily(deps, row.familyId);
}
