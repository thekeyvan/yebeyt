import { serve } from "@hono/node-server";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
  migrate, signInUser, linkIdentity, unlinkIdentity, listIdentities, setAppleRefreshToken, appleRefreshTokens,
  getUser, deleteUser, getState, putState,
} from "./db.js";
import { verifyApple, verifyGoogle, issueSession, readSession, type Identity } from "./auth.js";
import { exchangeAppleCode, revokeAppleToken } from "./apple.js";

type Env = { Variables: { userId: string } };
const app = new Hono<Env>();

app.get("/health", (c) => c.json({ ok: true }));

type Body = { identityToken?: string; authorizationCode?: string; name?: string; idToken?: string };
const readBody = (c: Context) => c.req.json<Body>().catch(() => ({}) as Body);

/** Verifies the provider token in the body. Apple also stores a refresh token (for revocation). */
async function identityFrom(provider: string, body: Body): Promise<Identity> {
  if (provider === "apple") {
    if (!body.identityToken) throw new Error("identityToken required");
    return verifyApple(body.identityToken);
  }
  if (provider === "google") {
    if (!body.idToken) throw new Error("idToken required");
    return verifyGoogle(body.idToken);
  }
  throw new Error("unknown provider");
}

async function keepAppleToken(id: Identity, body: Body) {
  if (id.provider !== "apple" || !body.authorizationCode) return;
  const refresh = await exchangeAppleCode(body.authorizationCode);
  if (refresh) await setAppleRefreshToken(id.subject, refresh);
}

async function me(userId: string) {
  const [user, identities] = await Promise.all([getUser(userId), listIdentities(userId)]);
  return { user, identities };
}

/** Sign in (or sign up). Same verified email across Apple and Google = one account. */
app.post("/v1/auth/:provider", async (c) => {
  const body = await readBody(c);
  let id: Identity;
  try {
    id = await identityFrom(c.req.param("provider"), body);
  } catch (e) {
    console.warn("sign-in rejected:", (e as Error).message);
    return c.json({ error: "invalid token" }, 401);
  }
  const user = await signInUser(id.provider, id.subject, id.email, body.name?.trim() || id.name);
  await keepAppleToken(id, body);
  return c.json({ token: await issueSession(user.id), ...(await me(user.id)) });
});

// Everything under /v1/me needs our session token.
const requireSession = async (c: Context<Env>, next: () => Promise<void>) => {
  const h = c.req.header("authorization") ?? "";
  try {
    c.set("userId", await readSession(h.startsWith("Bearer ") ? h.slice(7) : ""));
  } catch {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
};
app.use("/v1/me", requireSession);
app.use("/v1/me/*", requireSession);

app.get("/v1/me", async (c) => {
  const r = await me(c.get("userId"));
  return r.user ? c.json(r) : c.json({ error: "not found" }, 404);
});

/** Connects another sign-in method to this account (merging accounts if it had its own). */
app.post("/v1/me/identities/:provider", async (c) => {
  const body = await readBody(c);
  let id: Identity;
  try {
    id = await identityFrom(c.req.param("provider"), body);
  } catch (e) {
    console.warn("link rejected:", (e as Error).message);
    return c.json({ error: "invalid token" }, 401);
  }
  const result = await linkIdentity(c.get("userId"), id.provider, id.subject, id.email, body.name?.trim() || id.name);
  await keepAppleToken(id, body);
  return c.json({ result, ...(await me(c.get("userId"))) });
});

/** Disconnects a sign-in method; the last one can't be removed (delete the account instead). */
app.delete("/v1/me/identities/:provider", async (c) => {
  const { removed, appleTokens } = await unlinkIdentity(c.get("userId"), c.req.param("provider"));
  if (!removed) return c.json({ error: "last sign-in method" }, 409);
  await Promise.all(appleTokens.map(revokeAppleToken));
  return c.json(await me(c.get("userId")));
});

/** Deletes the account and everything stored for it; revokes Apple tokens (App Store requirement). */
app.delete("/v1/me", async (c) => {
  const tokens = await appleRefreshTokens(c.get("userId"));
  await Promise.all(tokens.map(revokeAppleToken));
  await deleteUser(c.get("userId"));
  return c.json({ ok: true });
});

/** The reader's synced state: kept couplets, reading history, streak days and settings. */
app.get("/v1/me/state", async (c) => c.json((await getState(c.get("userId"))) ?? { state: null, updatedAt: null }));

app.put("/v1/me/state", bodyLimit({ maxSize: 1024 * 1024 }), async (c) => {
  const body = await c.req.json<{ state?: unknown }>().catch(() => ({}) as { state?: unknown });
  if (typeof body.state !== "object" || body.state === null) return c.json({ error: "state required" }, 400);
  return c.json({ updatedAt: await putState(c.get("userId"), body.state) });
});

app.onError((e, c) => {
  console.error(e);
  return c.json({ error: "server error" }, 500);
});

const port = Number(process.env.PORT ?? 3000);
await migrate();
serve({ fetch: app.fetch, port, hostname: "::" }, () => console.log(`beyt server on :${port}`));
