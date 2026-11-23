import { createRoute, z } from "@hono/zod-openapi";
import { exchangeAppleCode } from "../auth/apple.js";
import { verifyAppleIdentityToken, verifyGoogleIdToken } from "../auth/providers.js";
import { issueSession, logoutSession, rotateSession } from "../auth/sessions.js";
import type { Deps } from "../deps.js";
import { errorResponse } from "../errors.js";
import { newRouter } from "../router.js";
import { refreshBodySchema, sessionSchema } from "../schemas.js";
import { getUserView, upsertUser, type Provider } from "../users.js";

const sessionResponses = {
  200: { description: "Signed in.", content: { "application/json": { schema: sessionSchema } } },
  400: errorResponse("Bad request."),
  401: errorResponse("The token is invalid, expired or not for this app."),
};

const appleBody = z
  .object({
    identityToken: z.string().min(1).max(8192),
    authorizationCode: z.string().min(1).max(2048).optional(),
    nonce: z.string().min(1).max(512).optional().openapi({ description: "The raw nonce; its sha256 was sent to Apple." }),
    fullName: z
      .object({ givenName: z.string().nullish(), familyName: z.string().nullish() })
      .nullish()
      .openapi({ description: "Accepted and ignored: the server keeps no names." }),
  })
  .openapi("AppleSignInRequest");

const googleBody = z.object({ idToken: z.string().min(1).max(8192) }).openapi("GoogleSignInRequest");

export function authRoutes(deps: Deps) {
  const app = newRouter();

  const startSession = async (provider: Provider, subject: string, appleToken?: string | null) => {
    const userId = await upsertUser(deps.db, provider, subject, appleToken);
    const tokens = await issueSession(deps, userId);
    return { ...tokens, user: (await getUserView(deps.db, userId))! };
  };

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/auth/apple",
      tags: ["auth"],
      summary: "Sign in with Apple",
      request: { body: { required: true, content: { "application/json": { schema: appleBody } } } },
      responses: sessionResponses,
    }),
    async (c) => {
      const body = c.req.valid("json");
      const identity = await verifyAppleIdentityToken(body.identityToken, body.nonce, deps);
      const sealed = body.authorizationCode ? await exchangeAppleCode(deps, body.authorizationCode, identity.audience) : null;
      return c.json(await startSession("apple", identity.subject, sealed), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/auth/google",
      tags: ["auth"],
      summary: "Sign in with Google",
      request: { body: { required: true, content: { "application/json": { schema: googleBody } } } },
      responses: sessionResponses,
    }),
    async (c) => {
      const identity = await verifyGoogleIdToken(c.req.valid("json").idToken, deps);
      return c.json(await startSession("google", identity.subject), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/auth/refresh",
      tags: ["auth"],
      summary: "Swap a refresh token for a new pair",
      description: "A refresh token works once. Using one again revokes the whole sign-in.",
      request: { body: { required: true, content: { "application/json": { schema: refreshBodySchema } } } },
      responses: sessionResponses,
    }),
    async (c) => {
      const { userId, ...tokens } = await rotateSession(deps, c.req.valid("json").refreshToken);
      return c.json({ ...tokens, user: (await getUserView(deps.db, userId))! }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/auth/logout",
      tags: ["auth"],
      summary: "End this sign-in",
      request: { body: { required: true, content: { "application/json": { schema: refreshBodySchema } } } },
      responses: { 204: { description: "Signed out (also when the token was unknown)." }, 400: errorResponse("Bad request.") },
    }),
    async (c) => {
      await logoutSession(deps, c.req.valid("json").refreshToken);
      return c.body(null, 204);
    },
  );

  return app;
}
