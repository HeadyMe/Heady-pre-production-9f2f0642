import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Heady Onboarding Middleware
 * Purpose: Fix the "skips directly to API key" bug after OAuth
 * 
 * Flow:
 * 1. User signs in with Google/HuggingFace
 * 2. OAuth callback sets auth_token cookie
 * 3. Middleware intercepts dashboard access
 * 4. Checks onboarding_complete cookie
 * 5. Redirects to /onboarding if not complete
 * 6. Only allows dashboard access after onboarding
 */

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const onboardingComplete = request.cookies.get('onboarding_complete')?.value;
  const url = request.nextUrl.clone();

  // If user is authenticated but trying to access dashboard
  if (token && url.pathname.startsWith('/dashboard')) {
    // Check if onboarding is complete
    if (!onboardingComplete || onboardingComplete !== 'true') {
      console.log('[Middleware] Onboarding not complete, redirecting to /onboarding');
      url.pathname = '/onboarding';
      return NextResponse.redirect(url);
    }
  }

  // If user is not authenticated and trying to access protected routes
  if (!token && (url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/onboarding'))) {
    console.log('[Middleware] Not authenticated, redirecting to /auth/signin');
    url.pathname = '/auth/signin';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/onboarding/:path*',
    '/api/user/:path*'
  ],
};
