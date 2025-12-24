/**
 * @fileoverview Next.js Middleware - Authentication, routing, and locale handling
 * 
 * @description
 * This middleware handles authentication, public route access, locale detection,
 * and dynamic route exceptions for the Common Knowledge Scout application.
 * It uses Clerk for authentication and provides locale cookie management.
 * 
 * @module core
 * 
 * @exports
 * - default: Clerk middleware function with authentication and locale handling
 * - config: Next.js middleware configuration with route matcher
 * 
 * @usedIn
 * - Next.js framework: Automatically executed by Next.js for all requests
 * - All API routes: Protected by authentication middleware
 * - All pages: Protected by authentication middleware
 * 
 * @dependencies
 * - @clerk/nextjs/server: Clerk authentication middleware
 * - @/lib/i18n: Locale detection and supported locales
 */

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getLocale, SUPPORTED_LOCALES, type Locale } from '@/lib/i18n';

// Startup-Log um zu bestätigen, dass Middleware geladen wird (nur in Development)
if (process.env.NODE_ENV === 'development') {
  console.log(`[MIDDLEWARE] 🚀 Middleware wird geladen - ${new Date().toISOString()}`);
}

// Liste der öffentlichen Routen, die ohne Anmeldung zugänglich sind
// Test-/Legacy-Routen entfernt. Externe Callbacks erfolgen über External-Jobs (siehe dynamische Ausnahme unten).
const isPublicRoute = createRouteMatcher([
  '/',
  '/docs(.*)',
  '/explore(.*)',
  '/api/public(.*)',
  // LLM-Modelle werden auch auf öffentlichen Seiten benötigt (z.B. Story-/Chat-UI).
  // Ohne diese Ausnahme maskiert Clerk die Route für anonyme Nutzer als 404.
  '/api/llm-models(.*)',
  '/api/markdown(.*)',
  '/info(.*)',
  '/sign-in(.*)', // Clerk Sign-In Route
  '/sign-up(.*)', // Clerk Sign-Up Route
  '/invite(.*)' // Invite-Accept Route
]);

// Public routes Log (nur in Development)
if (process.env.NODE_ENV === 'development') {
  console.log(`[MIDDLEWARE] 🔧 Public routes configured:`, [
    '/',
    '/docs(.*)',
    '/explore(.*)',
    '/api/public(.*)',
    '/api/llm-models(.*)',
    '/info(.*)',
  ]);
}

// Verwende die offizielle Clerk-Middleware
export default clerkMiddleware(async (auth, req) => {
  // Sprachauswahl verarbeiten
  const langParam = req.nextUrl.searchParams.get('lang');
  const cookieLocale = req.cookies.get('locale')?.value;
  const acceptLanguage = req.headers.get('accept-language') || undefined;
  
  // Ermittle aktuelle Sprache
  const locale = getLocale(
    req.nextUrl.searchParams,
    cookieLocale,
    acceptLanguage
  );
  
  // Erstelle Response und injiziere die ermittelte Locale als Request-Header,
  // damit Server Components (z.B. Layout) die Sprache ohne searchParams kennen
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-locale', locale);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
  
  // Setze Cookie für Sprachauswahl (30 Tage Gültigkeit)
  if (langParam && SUPPORTED_LOCALES.includes(langParam as Locale)) {
    // Benutzer hat explizit Sprache über URL-Parameter gewählt
    const expires = new Date();
    expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000);
    response.cookies.set('locale', langParam, {
      expires,
      path: '/',
      sameSite: 'lax',
    });
  } else if (!cookieLocale) {
    // Setze ermittelte Locale als Cookie wenn noch nicht gesetzt
    // (kann Browser-Sprache sein, wenn unterstützt, sonst DEFAULT_LOCALE)
    const expires = new Date();
    expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000);
    response.cookies.set('locale', locale, {
      expires,
      path: '/',
      sameSite: 'lax',
    });
  }

  // Harte Ausschlüsse: Statische Assets & Next-Interna niemals durch Middleware schützen
  const path = req.nextUrl.pathname;
  if (
    path.startsWith('/_next') ||
    path === '/favicon.ico' ||
    path.startsWith('/images/') || // Explizit /images/ Verzeichnis erlauben
    path.startsWith('/media/') || // Explizit /media/ Verzeichnis erlauben (Legacy-Support)
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
    const isChatApiPath = /^\/api\/chat\/[^/]+\/(docs|facets|config|stats|doc-meta|chats|doc-by-slug|speaker-images)$/.test(path);
    const isChatStreamPath = /^\/api\/chat\/[^/]+\/stream$/.test(path);
    const isTranslateDocumentPath = /^\/api\/chat\/[^/]+\/translate-document$/.test(path);
    if (
      (req.method === 'GET' && isChatApiPath) || 
      (req.method === 'POST' && (isChatStreamPath || isTranslateDocumentPath))
    ) {
      isPublic = true;
    }
  }

  // Dynamische Ausnahme: GET-Requests zu /api/libraries/[id]/access-check für anonyme Benutzer erlauben
  // Die API-Route prüft selbst, ob der Benutzer Zugriff hat
  if (!isPublic) {
    const path = req.nextUrl.pathname;
    const isAccessCheckPath = /^\/api\/libraries\/[^/]+\/access-check$/.test(path);
    if (req.method === 'GET' && isAccessCheckPath) {
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

  }

  // console.debug(`[Middleware] isPublicRoute: ${isPublic}`);
  
  if (isPublic) return response;

  try {
    await auth();
    await auth.protect();
    
  } catch (error) {
    // Nur bei echten Auth-Fehlern loggen, nicht bei 404 (normales Verhalten für anonyme Nutzer)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    if (errorMessage !== 'NEXT_HTTP_ERROR_FALLBACK;404') {
      console.error(`[MIDDLEWARE] Auth failed for ${req.nextUrl.pathname}`, {
        name: error instanceof Error ? error.name : 'Unknown',
        message: errorMessage
      })
    }
    throw error;
  }
  
  return response;
});

export const config = {
  matcher: [
    // Empfohlenes Muster: schließt _next, /images, /media und alle Pfade mit Dateiendungen aus
    '/((?!.+\\.[\\w]+$|_next|images|media).*)',
    '/',
    '/(api|trpc)(.*)'
  ],
}; 