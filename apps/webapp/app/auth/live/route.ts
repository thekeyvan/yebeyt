import { liveUrl } from "../../../lib/api/config";
import { bff } from "../../../lib/api/server";

/** `POST /auth/live`: a fresh access token for the live socket, and the socket's address. */
export const POST = (request: Request): Promise<Response> => bff.live(request, liveUrl());
