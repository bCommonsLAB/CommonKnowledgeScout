import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Liste der öffentlichen Routen, die ohne Anmeldung zugänglich sind
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/storage(.*)', // Storage API für Tests freigeben (sowohl /api/storage als auch /api/storage/filesystem)
  '/api/test-route(.*)', // Test-Route freigeben
]);

// Verwende die offizielle Clerk-Middleware
export default clerkMiddleware(async (auth, req) => {
  
  // Wenn die Route öffentlich ist, erlaube den Zugriff
  if (isPublicRoute(req)) {
    return;
  }

  // Für API-Routen, die Authentifizierung benötigen, prüfe nur ob ein Benutzer angemeldet ist
  // aber lasse sie trotzdem durch, damit die Route selbst die Authentifizierung handhaben kann
  if (req.nextUrl.pathname.startsWith('/api/')) {
    // Lass API-Routen durch - sie handhaben ihre eigene Authentifizierung
    return;
  }

  // Ansonsten schütze die Route - nur angemeldete Benutzer dürfen zugreifen
  await auth.protect();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}; 