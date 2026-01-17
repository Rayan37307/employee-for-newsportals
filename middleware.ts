import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

// Define protected routes that require authentication
const protectedRoutes = ["/dashboard", "/canvas", "/templates", "/sources", "/history", "/analytics"]

// Define auth routes (redirect if already authenticated)
const authRoutes = ["/auth/signin", "/auth/signup"]

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  })

  // Allow development fallback bypass if needed? 
  // For now strict.

  const { pathname } = request.nextUrl

  // Check if current path is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))

  // Redirect to signin if accessing protected route without authentication
  if (isProtectedRoute && !token) {
    const signInUrl = new URL("/auth/signin", request.url)
    signInUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(signInUrl)
  }

  // Redirect to dashboard if accessing auth routes while authenticated
  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, fonts, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|public).*)",
  ],
}
