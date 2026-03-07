import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

// Routes that don't require authentication
const publicRoutes = ["/", "/login", "/signup", "/api/auth"]

// Onboarding routes in order
const onboardingRoutes = [
  "/onboarding/create-account",
  "/onboarding/email-config", 
  "/onboarding/permissions",
  "/onboarding/buddy"
]

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Allow public routes
  if (publicRoutes.some(route => path.startsWith(route))) {
    return NextResponse.next()
  }

  // Check authentication
  const session = await auth()

  if (!session?.user) {
    // Redirect to login
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Check onboarding status
  const user = session.user

  if (!user.onboardingComplete) {
    const currentStep = user.onboardingStep || 0
    const expectedRoute = onboardingRoutes[currentStep]

    // If user is on the correct onboarding route, allow
    if (path === expectedRoute) {
      return NextResponse.next()
    }

    // If trying to access a later step, redirect to current step
    if (onboardingRoutes.includes(path)) {
      const requestedStep = onboardingRoutes.indexOf(path)
      if (requestedStep > currentStep) {
        return NextResponse.redirect(new URL(expectedRoute, request.url))
      }
      // Allow going back to previous steps
      return NextResponse.next()
    }

    // For any other route, redirect to current onboarding step
    return NextResponse.redirect(new URL(expectedRoute, request.url))
  }

  // User is authenticated and onboarded, allow access
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handled separately)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api).*)",
  ],
}
