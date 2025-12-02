/**
 * @fileoverview Library Access Check API Route
 * 
 * @description
 * API endpoint for checking if the current user has access to a library.
 * Returns access status and request information.
 * 
 * RATE LIMITING PROTECTION:
 * - In-Memory Cache für 10 Sekunden (verhindert zu viele Clerk-API-Calls)
 * - Retry-Logic mit exponential backoff für Clerk Rate Limits
 * - Reduziertes Logging während des normalen Betriebs
 * 
 * @module api
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { LibraryService } from '@/lib/services/library-service';
import { getAccessRequestByUserAndLibrary, hasUserAccess } from '@/lib/repositories/library-access-repo';
import { isModeratorOrOwner } from '@/lib/repositories/library-members-repo';

// In-Memory Cache für Access-Check-Ergebnisse (verhindert Rate Limiting)
// Key: `${libraryId}:${userEmail}`, Value: { result, timestamp }
const accessCheckCache = new Map<string, { result: unknown; timestamp: number }>();
const CACHE_TTL_MS = 10000; // 10 Sekunden Cache

// Helper: Cache-Key generieren
function getCacheKey(libraryId: string, userEmail: string): string {
  return `${libraryId}:${userEmail}`;
}

// Helper: Cache abrufen
function getCachedResult(libraryId: string, userEmail: string): unknown | null {
  const key = getCacheKey(libraryId, userEmail);
  const cached = accessCheckCache.get(key);
  if (!cached) return null;
  
  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL_MS) {
    accessCheckCache.delete(key);
    return null;
  }
  
  return cached.result;
}

// Helper: Cache setzen
function setCachedResult(libraryId: string, userEmail: string, result: unknown): void {
  const key = getCacheKey(libraryId, userEmail);
  accessCheckCache.set(key, { result, timestamp: Date.now() });
}

// Helper: Clerk-Aufruf mit Retry-Logic
async function getCurrentUserWithRetry(maxRetries = 3, retryDelay = 1000): Promise<ReturnType<typeof currentUser>> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await currentUser();
    } catch (error) {
      const isRateLimit = error && typeof error === 'object' && 'status' in error && error.status === 429;
      
      if (!isRateLimit || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff für Rate Limits
      const delay = retryDelay * Math.pow(2, attempt - 1);
      console.warn(`[API] Clerk Rate Limit, Retry ${attempt}/${maxRetries} nach ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * GET /api/libraries/[id]/access-check
 * Prüft ob aktueller Benutzer Zugriff auf Library hat
 * 
 * CACHING: Ergebnisse werden 10 Sekunden gecacht, um Rate Limiting zu vermeiden
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: libraryId } = await params;

    // Library laden
    const libraryService = LibraryService.getInstance();
    const library = await libraryService.getPublicLibraryById(libraryId);

    if (!library) {
      return NextResponse.json(
        { error: 'Library nicht gefunden oder nicht öffentlich' },
        { status: 404 }
      );
    }

    // Wenn requiresAuth nicht aktiv ist, hat jeder Zugriff
    if (!library.config?.publicPublishing?.requiresAuth) {
      return NextResponse.json({
        hasAccess: true,
      });
    }

    // Prüfe Authentifizierung mit Retry-Logic
    let userId: string | null = null;
    let userEmail: string | null = null;
    
    try {
      const authResult = await auth();
      userId = authResult.userId;
      
      if (!userId) {
        return NextResponse.json({
          hasAccess: false,
          requiresAuth: true,
          message: 'Bitte melden Sie sich an',
        });
      }

      // Versuche userEmail mit Retry-Logic zu holen
      const user = await getCurrentUserWithRetry();
      if (!user?.emailAddresses?.[0]?.emailAddress) {
        return NextResponse.json({
          hasAccess: false,
          requiresAuth: true,
          message: 'Keine E-Mail-Adresse gefunden',
        });
      }

      userEmail = user.emailAddresses[0].emailAddress;
      
      // Prüfe Cache mit vollständigem Key
      const cachedResult = getCachedResult(libraryId, userEmail);
      if (cachedResult) {
        return NextResponse.json(cachedResult);
      }
    } catch (error) {
      // Rate Limit Error behandeln
      const isRateLimit = error && typeof error === 'object' && 'status' in error && error.status === 429;
      if (isRateLimit) {
        console.error('[API] Clerk Rate Limit Error beim Access-Check:', {
          libraryId,
          userId: userId || 'unknown',
          error: error instanceof Error ? error.message : String(error),
        });
        // Bei Rate Limit: Gib generische Antwort zurück (kein Zugriff, aber nicht kritisch)
        return NextResponse.json({
          hasAccess: false,
          requiresAuth: true,
          message: 'Rate Limit erreicht. Bitte versuchen Sie es in wenigen Sekunden erneut.',
          rateLimited: true,
        }, { status: 429 });
      }
      throw error;
    }

    if (!userEmail) {
      return NextResponse.json({
        hasAccess: false,
        requiresAuth: true,
        message: 'Keine E-Mail-Adresse gefunden',
      });
    }

    // Prüfe ob Benutzer Owner oder Moderator ist
    const isOwnerOrModerator = await isModeratorOrOwner(libraryId, userEmail);
    if (isOwnerOrModerator) {
      const result = {
        hasAccess: true,
        isOwnerOrModerator: true,
      };
      setCachedResult(libraryId, userEmail, result);
      return NextResponse.json(result);
    }

    // Prüfe ob Benutzer Zugriff hat
    const hasAccess = await hasUserAccess(libraryId, userEmail);
    if (hasAccess) {
      const result = {
        hasAccess: true,
        status: 'approved' as const,
      };
      setCachedResult(libraryId, userEmail, result);
      return NextResponse.json(result);
    }

    // Prüfe ob es eine offene Anfrage gibt
    const accessRequest = await getAccessRequestByUserAndLibrary(libraryId, userEmail);
    if (accessRequest) {
      const result = {
        hasAccess: false,
        status: accessRequest.status,
        requestId: accessRequest.id,
      };
      setCachedResult(libraryId, userEmail, result);
      return NextResponse.json(result);
    }

    // Kein Zugriff, keine Anfrage
    const result = {
      hasAccess: false,
      status: undefined,
      message: 'Kein Zugriff. Bitte stellen Sie eine Anfrage.',
    };
    setCachedResult(libraryId, userEmail, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Fehler beim Prüfen des Zugriffs:', error);
    
    // Rate Limit Error separat behandeln
    const isRateLimit = error && typeof error === 'object' && 'status' in error && error.status === 429;
    if (isRateLimit) {
      return NextResponse.json({
        hasAccess: false,
        requiresAuth: true,
        message: 'Rate Limit erreicht. Bitte versuchen Sie es in wenigen Sekunden erneut.',
        rateLimited: true,
      }, { status: 429 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}
