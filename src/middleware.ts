import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Startup-Log um zu bestätigen, dass Middleware geladen wird
console.log(`[MIDDLEWARE] 🚀 Middleware wird geladen - ${new Date().toISOString()}`);

// Liste der öffentlichen Routen, die ohne Anmeldung zugänglich sind
// Test-/Legacy-Routen entfernt. Externe Callbacks erfolgen über External-Jobs (siehe dynamische Ausnahme unten).
const isPublicRoute = createRouteMatcher([
  '/',
  '/docs(.*)',
  '/explore(.*)',
  '/api/public(.*)'
]);

console.log(`[MIDDLEWARE] 🔧 Public routes configured:`, [
  '/',
  '/docs(.*)',
  '/explore(.*)',
  '/api/public(.*)',
]);

// Verwende die offizielle Clerk-Middleware
export default clerkMiddleware(async (auth, req) => {

  // Harte Ausschlüsse: Statische Assets & Next-Interna niemals durch Middleware schützen
  const path = req.nextUrl.pathname;
  if (
    path.startsWith('/_next') ||
    path === '/favicon.ico' ||
    /\.(?:css|js|map|png|jpg|jpeg|gif|webp|ico|svg|txt|woff|woff2|ttf)$/i.test(path)
  ) {
    return;
  }
  
  // Prüfe Public Routes (statisch) + dynamische Ausnahme für Job-Callbacks
  let isPublic = isPublicRoute(req);

  // Dynamische Ausnahme: GET-Requests zu /api/chat/[libraryId]/* für anonyme Benutzer erlauben
  // Die API-Routen prüfen selbst, ob die Library öffentlich ist
  if (!isPublic) {
    const path = req.nextUrl.pathname;
    const isChatApiPath = /^\/api\/chat\/[^/]+\/(docs|facets|config|stats|doc-meta|chats|toc-cache)$/.test(path);
    const isChatStreamPath = /^\/api\/chat\/[^/]+\/stream$/.test(path);
    if ((req.method === 'GET' && isChatApiPath) || (req.method === 'POST' && isChatStreamPath)) {
      isPublic = true;
    }
  }

  // Dynamische Ausnahme: Nur POST /api/external/jobs/:jobId erlauben (nicht /stream)
  if (!isPublic) {
    const path = req.nextUrl.pathname;
    const isJobsPath = path.startsWith('/api/external/jobs/');
    const isStream = path === '/api/external/jobs/stream' || path.endsWith('/stream');
    if (req.method === 'POST' && isJobsPath && !isStream) {
      isPublic = true;
    }

    // Interne/öffentliche Ausnahmen für Storage-Tokens & OneDrive-Refresh
    if (
      path === '/api/auth/onedrive/refresh' ||
      /\/api\/libraries\/.+\/tokens$/.test(path) ||
      path === '/api/storage/filesystem'
    ) {
      // Diese Routen schützen sich selbst (prüfen Header X-Internal-Request bzw. Clerk im Handler)
      isPublic = true;
    }

    // NEU: Interner Analyze-Endpoint für Kapitel – Bypass per Header
    if (!isPublic) {
      const isAnalyze = /^\/api\/chat\/[^/]+\/analyze-chapters$/.test(path)
      if (isAnalyze && req.method === 'POST') {
        const token = req.headers.get('x-internal-token') || req.headers.get('X-Internal-Token') || ''
        const jobHdr = req.headers.get('x-external-job') || req.headers.get('X-External-Job') || ''
        const env = process.env.INTERNAL_TEST_TOKEN || ''
        if ((token && env && token === env) || (!!jobHdr && jobHdr.length > 0)) {
          isPublic = true
        }
      }
    }
  }

  // console.debug(`[Middleware] isPublicRoute: ${isPublic}`);
  
  if (isPublic) return;

  try {
    await auth();
    await auth.protect();
    
  } catch (error) {
    console.error(`[MIDDLEWARE] Auth failed for ${req.nextUrl.pathname}`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
});

export const config = {
  matcher: [
    // Empfohlenes Muster: schließt _next und alle Pfade mit Dateiendungen aus
    '/((?!.+\\.[\\w]+$|_next).*)',
    '/',
    '/(api|trpc)(.*)'
  ],
}; 