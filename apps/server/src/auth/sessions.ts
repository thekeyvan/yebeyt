import { and, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { randomToken, sha256Hex } from "../crypto.js";
import { sessions, users } from "../db/schema.js";
import type { Deps } from "../deps.js";
import { ApiError } from "../errors.js";

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000;
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

/** Starts a refresh token in `familyId` (a new family for a new sign-in) and signs an access token. */
export async function issueSession(deps: SessionDeps, userId: string, familyId: string = randomUUID()): Promise<Tokens> {
  const refreshToken = randomToken();
  await deps.db.insert(sessions).values({
    userId,
    familyId,
    tokenHash: sha256Hex(refreshToken),
    expiresAt: new Date(deps.now().getTime() + REFRESH_TTL_MS),
  });
  return { accessToken: await signAccessToken(deps, userId), refreshToken };
}

const revokeFamily = (deps: SessionDeps, familyId: string) =>
  deps.db.update(sessions).set({ revokedAt: deps.now() }).where(and(eq(sessions.familyId, familyId), isNull(sessions.revokedAt)));

/**
 * Swaps a refresh token for a new pair. A token can be used once: showing it again means it leaked,
 * so the whole family (every token from that sign-in) is revoked.
 */
export async function rotateSession(deps: SessionDeps, refreshToken: string): Promise<Tokens & { userId: string }> {
  const [row] = await deps.db.select().from(sessions).where(eq(sessions.tokenHash, sha256Hex(refreshToken)));
  if (!row || row.revokedAt || row.expiresAt <= deps.now()) throw new ApiError(401, "invalid_token");

  // The update only matches an unused token, so two parallel uses cannot both win.
  const claimed = await deps.db
    .update(sessions)
    .set({ usedAt: deps.now() })
    .where(and(eq(sessions.id, row.id), isNull(sessions.usedAt)))
    .returning({ id: sessions.id });
  if (claimed.length === 0) {
    await revokeFamily(deps, row.familyId);
    throw new ApiError(401, "invalid_token");
  }
  const [user] = await deps.db.select({ id: users.id }).from(users).where(eq(users.id, row.userId));
  if (!user) throw new ApiError(401, "invalid_token");
  return { ...(await issueSession(deps, row.userId, row.familyId)), userId: row.userId };
}

/** Ends the sign-in the refresh token belongs to. Unknown tokens are ignored. */
export async function logoutSession(deps: SessionDeps, refreshToken: string): Promise<void> {
  const [row] = await deps.db.select().from(sessions).where(eq(sessions.tokenHash, sha256Hex(refreshToken)));
  if (row) await revokeFamily(deps, row.familyId);
}
