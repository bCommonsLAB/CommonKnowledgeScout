import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Startup-Log um zu bestätigen, dass Middleware geladen wird
console.log(`[MIDDLEWARE] 🚀 Middleware wird geladen - ${new Date().toISOString()}`);

// Liste der öffentlichen Routen, die ohne Anmeldung zugänglich sind
const isPublicRoute = createRouteMatcher([
  '/',
  '/docs(.*)',
  '/api/test-route(.*)', // Test-Route freigeben
  '/api/settings/oauth-defaults', // OAuth-Defaults ohne Auth
  '/api/env-test', // Umgebungstests
  '/api/db-test', // Datenbanktests
  '/api/external/webhook', // Webhook muss öffentlich sein
]);

console.log(`[MIDDLEWARE] 🔧 Public routes configured:`, [
  '/',
  '/docs(.*)',
  '/api/test-route(.*)',
  '/api/settings/oauth-defaults',
  '/api/env-test',
  '/api/db-test',
]);

// Verwende die offizielle Clerk-Middleware
export default clerkMiddleware(async (auth, req) => {
  
  // Umfassende Debug-Logging
  console.log(`\n=== [MIDDLEWARE] START ===`);
  console.log(`[Middleware] Processing route: ${req.nextUrl.pathname}`);
  console.log(`[Middleware] Full URL: ${req.url}`);
  console.log(`[Middleware] Method: ${req.method}`);
  console.log(`[Middleware] Headers:`, {
    'user-agent': req.headers.get('user-agent')?.substring(0, 50),
    'cookie': req.headers.get('cookie') ? 'Present' : 'Missing',
    'authorization': req.headers.get('authorization') ? 'Present' : 'Missing'
  });
  
  // Prüfe Public Routes
  const isPublic = isPublicRoute(req);
  console.log(`[Middleware] isPublicRoute check result: ${isPublic}`);
  
  if (isPublic) {
    console.log(`[Middleware] ✅ Route is public, allowing through: ${req.nextUrl.pathname}`);
    console.log(`=== [MIDDLEWARE] END (PUBLIC) ===\n`);
    return;
  }

  console.log(`[Middleware] 🔒 Route requires auth protection: ${req.nextUrl.pathname}`);
  
  try {
    // Prüfe auth() vor protect()
    console.log(`[Middleware] Calling auth() to check current state...`);
    const authResult = await auth();
    console.log(`[Middleware] auth() result:`, {
      hasUserId: !!authResult.userId,
      userId: authResult.userId ? `${authResult.userId.substring(0, 8)}...` : null
    });
    
    console.log(`[Middleware] Calling auth.protect()...`);
    await auth.protect();
    console.log(`[Middleware] ✅ Auth protection completed successfully for: ${req.nextUrl.pathname}`);
    
  } catch (error) {
    console.error(`[Middleware] ❌ Auth protection failed for: ${req.nextUrl.pathname}`);
    console.error(`[Middleware] Error details:`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3) : 'No stack'
    });
    throw error;
  }
  
  console.log(`=== [MIDDLEWARE] END (PROTECTED) ===\n`);
});

export const config = {
  matcher: [
    // Explizite API-Route-Matcher
    '/api/:path*',
    '/trpc/:path*',
    // Alle anderen Routen außer statische Assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)).*)',
  ],
}; 