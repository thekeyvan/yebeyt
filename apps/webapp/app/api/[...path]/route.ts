import { apiUrl } from "../../../lib/api/config";
import { upstreamPath, upstreamQuery } from "../../../lib/api/proxy";

/** How long the server may take before the proxy gives up. */
const timeoutMs = 10_000;

/** What of the server's answer is passed on: the type and what lets the browser cache the picture and ask again (`If-None-Match` goes the other way). */
const passed = ["content-type", "etag", "cache-control"];

type Context = { params: Promise<{ path: string[] }> };

/** The web app's own door to the server, so the page needs no CORS (and, from W4, no token): for now only GET of the poet pictures. */
export async function GET(request: Request, { params }: Context): Promise<Response> {
  const path = upstreamPath((await params).path);
  if (path === undefined) return new Response(null, { status: 404 });
  const headers = new Headers();
  const match = request.headers.get("if-none-match");
  if (match) headers.set("if-none-match", match);
  try {
    const upstream = await fetch(`${apiUrl()}${path}${upstreamQuery(new URL(request.url).searchParams)}`, { headers, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    if (![200, 304, 404].includes(upstream.status)) return new Response(null, { status: 502 });
    const answer = new Headers();
    for (const name of passed) {
      const value = upstream.headers.get(name);
      if (value) answer.set(name, value);
    }
    return new Response(upstream.status === 304 ? null : upstream.body, { status: upstream.status, headers: answer });
  } catch {
    return new Response(null, { status: 502 });
  }
}
