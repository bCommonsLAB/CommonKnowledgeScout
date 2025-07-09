/**
 * Next.js Middleware für CommonKnowledgeScout
 * Unterstützt sowohl Clerk-Authentifizierung als auch Offline-Betrieb
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthConfig } from './lib/auth/types';

// Öffentliche Routen, die keine Authentifizierung erfordern
const publicRoutes = [
  '/',
  '/api/health',
  '/api/status',
  '/api/env-test',
  '/api/test-route',
  '/auth/microsoft/callback',
  '/api/auth/onedrive/callback',
  '/api/auth/onedrive/refresh'
];

// API-Routen, die in Offline-Modus verfügbar sind
const offlineApiRoutes = [
  '/api/storage/filesystem',
  '/api/storage/filesystem/upload-archive',
  '/api/teststorage',
  '/api/db-test',
  '/api/libraries',
  '/api/sessions',
  '/api/event-job'
];

// Hilfsfunktion zum Prüfen, ob eine Route öffentlich ist
function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(route => pathname.startsWith(route));
}

// Hilfsfunktion zum Prüfen, ob eine API-Route im Offline-Modus verfügbar ist
function isOfflineApiRoute(pathname: string): boolean {
  return offlineApiRoutes.some(route => pathname.startsWith(route));
}

// Offline-Middleware-Handler
function handleOfflineMode(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Öffentliche Routen sind immer verfügbar
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }
  
  // API-Routen prüfen
  if (pathname.startsWith('/api/')) {
    // Offline-API-Routen sind verfügbar
    if (isOfflineApiRoute(pathname)) {
      // Füge Offline-User-Header hinzu
      const response = NextResponse.next();
      response.headers.set('x-auth-mode', 'offline');
      response.headers.set('x-user-id', 'offline-user');
      response.headers.set('x-user-email', 'offline@example.com');
      return response;
    }
    
    // Andere API-Routen sind im Offline-Modus nicht verfügbar
    return NextResponse.json(
      { error: 'API-Route nicht verfügbar im Offline-Modus' }, 
      { status: 503 }
    );
  }
  
  // Alle anderen Routen sind im Offline-Modus verfügbar
  const response = NextResponse.next();
  response.headers.set('x-auth-mode', 'offline');
  response.headers.set('x-user-id', 'offline-user');
  response.headers.set('x-user-email', 'offline@example.com');
  return response;
}

// Clerk-Middleware-Handler (vereinfacht)
async function handleClerkMode(request: NextRequest) {
  try {
    // Für jetzt verwenden wir eine vereinfachte Clerk-Authentifizierung
    // Die komplexe Clerk-Middleware wird später in den spezifischen Routen gehandhabt
    
    const { pathname } = request.nextUrl;
    
    // Prüfe, ob die Route geschützt ist
    const protectedRoutes = [
      '/library',
      '/settings',
      '/session-manager',
      '/event-monitor',
      '/templates'
    ];
    
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
    
    if (isProtectedRoute) {
      // Für geschützte Routen: Prüfe, ob Clerk verfügbar ist
      const hasClerkKeys = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && 
                           process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== 'dummy_pk_test_placeholder';
      
      if (!hasClerkKeys) {
        // Fallback zu Offline-Modus
        console.log('Keine Clerk-Keys verfügbar, verwende Offline-Modus');
        return handleOfflineMode(request);
      }
    }
    
    // Füge Auth-Mode-Header hinzu
    const response = NextResponse.next();
    response.headers.set('x-auth-mode', 'clerk');
    return response;
    
  } catch (error) {
    console.error('Fehler beim Laden der Clerk-Middleware:', error);
    
    // Fallback zu Offline-Modus
    console.log('Fallback zu Offline-Modus aufgrund von Clerk-Fehler');
    return handleOfflineMode(request);
  }
}

// Hauptmiddleware-Funktion
export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Prüfe Auth-Konfiguration
  const config = getAuthConfig();
  
  // Debug-Logging
  console.log(`[Middleware] ${pathname} - Auth-Modus: ${config.mode}`);
  
  // Statische Assets und Next.js interne Routen überspringen
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.') ||
    pathname.startsWith('/favicon.ico')
  ) {
    return NextResponse.next();
  }
  
  // Wähle den entsprechenden Handler basierend auf Auth-Modus
  if (config.mode === 'offline') {
    return handleOfflineMode(request);
  } else {
    return handleClerkMode(request);
  }
}

// Konfiguration für Middleware-Matching
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - *.png, *.jpg, *.jpeg, *.gif, *.svg, *.ico (static assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
}; 