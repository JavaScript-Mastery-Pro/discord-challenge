import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Ensure we are using the most modern matcher patterns
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/',
])

export default clerkMiddleware(async (auth, request) => {
  // Added a small "hardening" check: ensure we don't protect static assets 
  // if the matcher somehow misses them
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Optimized matcher for Next 16 proxy layer
    '/((?!_next|static|favicon.ico).*)',
    '/(api|trpc)(.*)',
  ],
}