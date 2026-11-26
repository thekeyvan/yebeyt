import { bff } from "../../../lib/api/server";

/** `POST /auth/apple`: what Sign in with Apple JS gave the page; the session goes into cookies and the page gets the user (`lib/api/bff.ts`). */
export const POST = (request: Request): Promise<Response> => bff.signIn(request, "apple");
