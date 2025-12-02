/**
 * @fileoverview Library Access Check API Route
 * 
 * @description
 * API endpoint for checking if the current user has access to a library.
 * Returns access status and request information.
 * 
 * @module api
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { LibraryService } from '@/lib/services/library-service';
import { getAccessRequestByUserAndLibrary, hasUserAccess } from '@/lib/repositories/library-access-repo';
import { isModeratorOrOwner } from '@/lib/repositories/library-members-repo';

/**
 * GET /api/libraries/[id]/access-check
 * Prüft ob aktueller Benutzer Zugriff auf Library hat
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: libraryId } = await params;
    
    // Debug-Logging
    console.log('[API] Access-Check Route aufgerufen für Library:', libraryId);
    console.log('[API] Request URL:', request.url);

    // Library laden
    const libraryService = LibraryService.getInstance();
    console.log('[API] Rufe getPublicLibraryById auf mit ID:', libraryId);
    const library = await libraryService.getPublicLibraryById(libraryId);
    console.log('[API] getPublicLibraryById Ergebnis:', library ? `Library gefunden: ${library.id}` : 'null');

    if (!library) {
      console.error('[API] Library nicht gefunden oder nicht öffentlich:', libraryId);
      return NextResponse.json(
        { error: 'Library nicht gefunden oder nicht öffentlich' },
        { status: 404 }
      );
    }
    
    console.log('[API] Library gefunden:', library.id, 'requiresAuth:', library.config?.publicPublishing?.requiresAuth);

    // Wenn requiresAuth nicht aktiv ist, hat jeder Zugriff
    if (!library.config?.publicPublishing?.requiresAuth) {
      return NextResponse.json({
        hasAccess: true,
      });
    }

    // Prüfe Authentifizierung
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({
        hasAccess: false,
        requiresAuth: true,
        message: 'Bitte melden Sie sich an',
      });
    }

    const user = await currentUser();
    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json({
        hasAccess: false,
        requiresAuth: true,
        message: 'Keine E-Mail-Adresse gefunden',
      });
    }

    const userEmail = user.emailAddresses[0].emailAddress;

    // Prüfe ob Benutzer Owner oder Moderator ist
    const isOwnerOrModerator = await isModeratorOrOwner(libraryId, userEmail);
    if (isOwnerOrModerator) {
      return NextResponse.json({
        hasAccess: true,
        isOwnerOrModerator: true,
      });
    }

    // Prüfe ob Benutzer Zugriff hat
    const hasAccess = await hasUserAccess(libraryId, userEmail);
    if (hasAccess) {
      return NextResponse.json({
        hasAccess: true,
        status: 'approved',
      });
    }

    // Prüfe ob es eine offene Anfrage gibt
    const accessRequest = await getAccessRequestByUserAndLibrary(libraryId, userEmail);
    if (accessRequest) {
      return NextResponse.json({
        hasAccess: false,
        status: accessRequest.status,
        requestId: accessRequest.id,
      });
    }

    // Kein Zugriff, keine Anfrage
    return NextResponse.json({
      hasAccess: false,
      status: undefined,
      message: 'Kein Zugriff. Bitte stellen Sie eine Anfrage.',
    });
  } catch (error) {
    console.error('[API] Fehler beim Prüfen des Zugriffs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}



