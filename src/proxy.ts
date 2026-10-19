import { NextResponse, type NextRequest } from "next/server";
import { SITE_COOKIE, sitePasswordEnabled, siteToken } from "@/lib/site-auth";

// Paths reachable without the site password: Teams bot callbacks, signed
// review links (they carry their own HMAC token), the scheduler and login.
const PUBLIC = [/^\/api\/teams\//, /^\/api\/cron\//, /^\/review\//, /^\/login$/];

export async function proxy(request: NextRequest) {
  if (!sitePasswordEnabled()) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
  if (request.cookies.get(SITE_COOKIE)?.value === (await siteToken())) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL("/login", request.url);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
