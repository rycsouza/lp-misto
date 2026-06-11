import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow login page through
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = req.cookies.get("misto_admin_token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", req.nextUrl));
  }

  try {
    const secret = process.env.ADMIN_JWT_SECRET ?? process.env.ENCRYPTION_KEY;
    if (!secret) {
      return NextResponse.redirect(new URL("/admin/login", req.nextUrl));
    }
    const encodedKey = new TextEncoder().encode(secret);
    await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", req.nextUrl));
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
