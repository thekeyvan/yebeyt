import { bff } from "../../../lib/api/server";

/** `POST /auth/logout`: ends the sign-in and clears the cookies. */
export const POST = (request: Request): Promise<Response> => bff.logout(request);
