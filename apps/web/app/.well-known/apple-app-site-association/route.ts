import { aasa } from "../../../lib/aasa";

export const dynamic = "force-static";

/** Apple fetches this without following redirects, and wants application/json. */
export function GET() {
  return Response.json(aasa, { headers: { "cache-control": "public, max-age=3600" } });
}
