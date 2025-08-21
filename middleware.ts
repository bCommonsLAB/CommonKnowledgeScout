import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';


// Liste der öffentlichen Routen
const isPublicRoute = createRouteMatcher([
  '/',
  '/docs(.*)',
  '/api/test-route(.*)',
  '/api/settings/oauth-defaults',
  '/api/env-test',
  '/api/db-test',
  // Webhook-Endpunkte müssen öffentlich zugänglich sein (keine Clerk-Auth)
  '/api/external/webhook',
]);

export default clerkMiddleware(async (auth, req) => {

  const isPublic = isPublicRoute(req);
  if (isPublic) {
    return;
  }

  try {
    const result = await auth();
    await auth.protect();
  } catch (error) {
    console.error(`[RootMiddleware] ❌ Auth failed`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }

});

export const config = {
  matcher: [
    '/api/:path*',
    '/trpc/:path*',
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)).*)',
  ],
};


