import { bff } from "../../../lib/api/server";

/** `POST /auth/google`: the id token Google Identity Services gave the page. */
export const POST = (request: Request): Promise<Response> => bff.signIn(request, "google");
