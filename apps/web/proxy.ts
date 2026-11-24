import { NextResponse, type NextRequest } from "next/server";
import { wwwRedirect } from "./lib/host";

// www.yebeyt.com goes to the apex (this is Next's middleware; version 16 calls the file `proxy`).
export function proxy(request: NextRequest) {
  const target = wwwRedirect(request.headers.get("host"), request.nextUrl.pathname + request.nextUrl.search);
  return target ? NextResponse.redirect(target, 308) : NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|fonts/).*)"] };
