import { bff } from "../../../lib/api/server";

type Context = { params: Promise<{ path: string[] }> };

/** The web app's own door to the server: no CORS, and the session cookie becomes a Bearer token here (`lib/api/bff.ts`). Only the paths of `lib/api/proxy.ts` go through. */
const door = async (request: Request, { params }: Context): Promise<Response> => bff.proxy(request, (await params).path);

export { door as GET, door as PUT, door as POST, door as DELETE };
