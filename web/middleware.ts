import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://api.mapbox.com",
  "connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://*.mapbox.com http://localhost:8000",
  "img-src 'self' data: blob: https://*.mapbox.com",
  "style-src 'self' 'unsafe-inline' https://api.mapbox.com https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "worker-src blob:",
  "frame-ancestors 'none'",
].join("; ")

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Content-Security-Policy", CSP)
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  return response
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const { pathname } = req.nextUrl

    // Role enforcement
    if (pathname.startsWith("/clinic") && token?.role !== "researcher") {
      const url = req.nextUrl.clone()
      url.pathname = "/"
      const res = NextResponse.redirect(url)
      return addSecurityHeaders(res)
    }

    if (
      (pathname.startsWith("/api/match") || pathname.startsWith("/api/upload")) &&
      token?.role !== "patient"
    ) {
      return addSecurityHeaders(
        new NextResponse(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        })
      )
    }

    return addSecurityHeaders(NextResponse.next())
  },
  {
    callbacks: {
      // Allow unauthenticated access to /, /api/auth, and static assets — everything else requires login
      authorized({ token, req }) {
        const { pathname } = req.nextUrl
        if (
          pathname === "/" ||
          pathname.startsWith("/api/auth/register") ||
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/api/admin") ||
          pathname.startsWith("/_next") ||
          pathname.startsWith("/favicon")
        ) {
          return true
        }
        return !!token
      },
    },
  }
)

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
