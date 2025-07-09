/**
 * Server-Auth-Abstraktionsschicht
 * Bietet einheitliche Auth-Funktionen für API-Routen
 */

import { NextRequest } from 'next/server';
import { AuthUser, getAuthConfig } from './types';
import { mockAuth } from './mock-server';

/**
 * Universelle Auth-Funktion für API-Routen
 * Funktioniert sowohl mit Clerk als auch im Offline-Modus
 */
export async function getServerAuth(request?: NextRequest) {
  const config = getAuthConfig();
  
  // Prüfe auf Offline-Modus über Header (gesetzt von Middleware)
  const authMode = request?.headers.get('x-auth-mode') || config.mode;
  
  if (authMode === 'offline') {
    // Offline-Modus: Verwende Mock-Auth
    const userId = request?.headers.get('x-user-id') || 'offline-user';
    const userEmail = request?.headers.get('x-user-email') || 'offline@example.com';
    
    return {
      userId,
      user: {
        id: userId,
        email: userEmail,
        firstName: 'Offline',
        lastName: 'User',
        fullName: 'Offline User',
        imageUrl: undefined
      } as AuthUser
    };
  }
  
  // Clerk-Modus: Versuche Clerk zu laden
  try {
    const { auth } = await import('@clerk/nextjs/server');
    const authResult = await auth();
    
    if (!authResult.userId) {
      return { userId: null, user: null };
    }
    
    // Lade Benutzerinformationen
    const { currentUser } = await import('@clerk/nextjs/server');
    const clerkUser = await currentUser();
    
    if (!clerkUser) {
      return { userId: authResult.userId, user: null };
    }
    
    // Konvertiere Clerk-User zu AuthUser
    const user: AuthUser = {
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      firstName: clerkUser.firstName || undefined,
      lastName: clerkUser.lastName || undefined,
      fullName: clerkUser.fullName || undefined,
      imageUrl: clerkUser.imageUrl || undefined
    };
    
    return { userId: authResult.userId, user };
    
  } catch (error) {
    console.warn('Clerk Server nicht verfügbar, verwende Offline-Modus:', error);
    
    // Fallback zu Offline-Modus
    return mockAuth();
  }
}

/**
 * Vereinfachte currentUser-Funktion
 */
export async function getCurrentUser(request?: NextRequest): Promise<AuthUser | null> {
  const authResult = await getServerAuth(request);
  return authResult.user;
}

/**
 * Vereinfachte Auth-Prüfung
 */
export async function requireAuth(request?: NextRequest) {
  const authResult = await getServerAuth(request);
  
  if (!authResult.userId || !authResult.user) {
    throw new Error('Authentication required');
  }
  
  return authResult;
}

/**
 * Hilfsfunktion für API-Routen
 * Extrahiert Authentifizierungsinformationen aus Request
 */
export function getAuthFromRequest(request: NextRequest) {
  return {
    mode: request.headers.get('x-auth-mode') || 'clerk',
    userId: request.headers.get('x-user-id'),
    userEmail: request.headers.get('x-user-email')
  };
}

/**
 * Middleware-Funktion für API-Routen
 * Kann in API-Routen verwendet werden, um Auth zu handhaben
 */
export async function withAuth<T>(
  request: NextRequest,
  handler: (auth: { userId: string; user: AuthUser }) => Promise<T>
): Promise<T> {
  const authResult = await requireAuth(request);
  return handler(authResult);
}

/**
 * Optionale Auth-Middleware für API-Routen
 * Stellt Auth-Informationen zur Verfügung, aber erfordert keine Authentifizierung
 */
export async function withOptionalAuth<T>(
  request: NextRequest,
  handler: (auth: { userId: string | null; user: AuthUser | null }) => Promise<T>
): Promise<T> {
  try {
    const authResult = await getServerAuth(request);
    return handler(authResult);
  } catch {
    // Fehler ignorieren und ohne Auth fortfahren
    return handler({ userId: null, user: null });
  }
} 