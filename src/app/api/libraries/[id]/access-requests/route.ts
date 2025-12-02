/**
 * @fileoverview Library Access Requests List API Route
 * 
 * @description
 * API endpoint for listing access requests for a library. Only accessible
 * by library owners and moderators.
 * 
 * @module api
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { listAccessRequestsForLibrary } from '@/lib/repositories/library-access-repo';
import { isModeratorOrOwner } from '@/lib/repositories/library-members-repo';

/**
 * GET /api/libraries/[id]/access-requests
 * Listet alle Zugriffsanfragen für eine Library (nur für Owner/Moderatoren)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: libraryId } = await params;

    // Authentifizierung prüfen
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    const user = await currentUser();
    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json(
        { error: 'Keine E-Mail-Adresse gefunden' },
        { status: 401 }
      );
    }

    const userEmail = user.emailAddresses[0].emailAddress;

    // Prüfe ob Benutzer Owner oder Moderator ist
    const hasPermission = await isModeratorOrOwner(libraryId, userEmail);
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Keine Berechtigung' },
        { status: 403 }
      );
    }

    // Optional: Filter nach Status
    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get('status');
    const status = statusParam === 'pending' || statusParam === 'approved' || statusParam === 'rejected'
      ? statusParam
      : undefined;

    // Liste der Zugriffsanfragen abrufen
    const requests = await listAccessRequestsForLibrary(libraryId, status);

    return NextResponse.json({
      requests,
      count: requests.length,
    });
  } catch (error) {
    console.error('[API] Fehler beim Abrufen der Zugriffsanfragen:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

