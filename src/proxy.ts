import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login"];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/favicon") ||
    pathname === "/manifest.webmanifest"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("ipd-session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Lightweight JWT verification (no DB call in proxy)
  try {
    const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!);
    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(token, SECRET);
    if (!payload) throw new Error("Invalid token");
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("ipd-session");
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons).*)"],
};
