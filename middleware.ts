import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Startup-Log um zu bestätigen, dass Root-Middleware geladen wird
console.log(`[MIDDLEWARE-ROOT] 🚀 Root-Middleware wird geladen - ${new Date().toISOString()}`);

// Liste der öffentlichen Routen
const isPublicRoute = createRouteMatcher([
  '/',
  '/docs(.*)',
  '/api/test-route(.*)',
  '/api/settings/oauth-defaults',
  '/api/env-test',
  '/api/db-test',
]);

export default clerkMiddleware(async (auth, req) => {
  console.log(`\n=== [MIDDLEWARE-ROOT] START ===`);
  console.log(`[RootMiddleware] Processing route: ${req.nextUrl.pathname}`);

  const isPublic = isPublicRoute(req);
  console.log(`[RootMiddleware] isPublicRoute: ${isPublic}`);
  if (isPublic) {
    console.log(`[RootMiddleware] ✅ Public route, allow`);
    console.log(`=== [MIDDLEWARE-ROOT] END (PUBLIC) ===\n`);
    return;
  }

  try {
    console.log(`[RootMiddleware] Calling auth()`);
    const result = await auth();
    console.log(`[RootMiddleware] auth() userId:`, result.userId ? `${result.userId.substring(0,8)}...` : null);
    await auth.protect();
    console.log(`[RootMiddleware] ✅ Protected`);
  } catch (error) {
    console.error(`[RootMiddleware] ❌ Auth failed`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }

  console.log(`=== [MIDDLEWARE-ROOT] END (PROTECTED) ===\n`);
});

export const config = {
  matcher: [
    '/api/:path*',
    '/trpc/:path*',
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)).*)',
  ],
};


