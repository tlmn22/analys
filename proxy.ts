import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, readSessionToken } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    return NextResponse.redirect(loginUrl);
  }

  if (session.role === "club_staff" && !/^\/admin\/(?:club-events(?:\/[^/]+\/attendance)?|club-reports|club-load-monitoring)\/?$/.test(pathname)) {
    return NextResponse.redirect(new URL("/admin/club-events", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
