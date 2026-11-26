import { bff } from "../../../lib/api/server";

/** `GET /auth/session`: who is signed in. */
export const GET = (request: Request): Promise<Response> => bff.session(request);
