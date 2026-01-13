/**
 * @fileoverview Library Members API Route
 * 
 * @description
 * API endpoint for managing library members (moderators).
 * Only owners can add/remove moderators.
 * 
 * @module api
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { addMember, removeMember, listMembers } from '@/lib/repositories/library-members-repo';
import { LibraryService } from '@/lib/services/library-service';
import { getPreferredUserEmail, normalizeEmail } from '@/lib/auth/user-email';

/**
 * GET /api/libraries/[id]/members
 * Listet alle Mitglieder (Moderatoren) einer Library
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
    const userEmail = getPreferredUserEmail(user);
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Keine E-Mail-Adresse gefunden' },
        { status: 401 }
      );
    }

    // Prüfe ob Benutzer Owner ist (nur Owner können Mitglieder sehen)
    const libraryService = LibraryService.getInstance();
    try {
      await libraryService.getLibrary(userEmail, libraryId);
    } catch {
      return NextResponse.json(
        { error: 'Keine Berechtigung. Nur Owner können Mitglieder verwalten.' },
        { status: 403 }
      );
    }

    // Lade alle Mitglieder
    const members = await listMembers(libraryId);

    return NextResponse.json({
      members,
    });
  } catch (error) {
    console.error('[API] Fehler beim Laden der Mitglieder:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/libraries/[id]/members
 * Fügt einen Moderator zu einer Library hinzu
 * 
 * Body: { email: string, role: 'moderator' }
 */
export async function POST(
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
    const userEmail = getPreferredUserEmail(user);
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Keine E-Mail-Adresse gefunden' },
        { status: 401 }
      );
    }

    // Prüfe ob Benutzer Owner ist (nur Owner können Moderatoren hinzufügen)
    const libraryService = LibraryService.getInstance();
    try {
      await libraryService.getLibrary(userEmail, libraryId);
    } catch {
      return NextResponse.json(
        { error: 'Keine Berechtigung. Nur Owner können Moderatoren hinzufügen.' },
        { status: 403 }
      );
    }

    // Request Body parsen
    const body = await request.json().catch(() => ({}));
    const { email: memberEmail, role } = body;

    // Validierung
    if (!memberEmail || typeof memberEmail !== 'string') {
      return NextResponse.json(
        { error: 'E-Mail-Adresse ist erforderlich' },
        { status: 400 }
      );
    }

    if (role !== 'moderator') {
      return NextResponse.json(
        { error: 'Ungültige Rolle. Nur "moderator" ist erlaubt.' },
        { status: 400 }
      );
    }

    const normalizedMemberEmail = normalizeEmail(memberEmail);
    if (!normalizedMemberEmail) {
      return NextResponse.json(
        { error: 'E-Mail-Adresse ist erforderlich' },
        { status: 400 }
      );
    }

    // Prüfe ob Benutzer bereits Owner ist (Owner können nicht als Moderator hinzugefügt werden)
    try {
      await libraryService.getLibrary(normalizedMemberEmail, libraryId);
      return NextResponse.json(
        { error: 'Dieser Benutzer ist bereits Owner der Library.' },
        { status: 400 }
      );
    } catch {
      // Owner-Check fehlgeschlagen = Benutzer ist nicht Owner, kann als Moderator hinzugefügt werden
    }

    // Füge Moderator hinzu
    await addMember(libraryId, normalizedMemberEmail, role, userEmail);

    return NextResponse.json({
      success: true,
      message: 'Moderator wurde erfolgreich hinzugefügt',
    });
  } catch (error) {
    console.error('[API] Fehler beim Hinzufügen des Moderators:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/libraries/[id]/members
 * Entfernt einen Moderator aus einer Library
 * 
 * Query: ?email=user@example.com
 */
export async function DELETE(
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
    const userEmail = getPreferredUserEmail(user);
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Keine E-Mail-Adresse gefunden' },
        { status: 401 }
      );
    }

    // Prüfe ob Benutzer Owner ist (nur Owner können Moderatoren entfernen)
    const libraryService = LibraryService.getInstance();
    try {
      await libraryService.getLibrary(userEmail, libraryId);
    } catch {
      return NextResponse.json(
        { error: 'Keine Berechtigung. Nur Owner können Moderatoren entfernen.' },
        { status: 403 }
      );
    }

    // Query-Parameter parsen
    const searchParams = request.nextUrl.searchParams;
    const memberEmail = searchParams.get('email');

    if (!memberEmail) {
      console.error('[API] DELETE /members: Keine E-Mail-Adresse im Query-Parameter gefunden');
      return NextResponse.json(
        { error: 'E-Mail-Adresse ist erforderlich' },
        { status: 400 }
      );
    }

    console.log('[API] DELETE /members: Entferne Moderator', { libraryId, memberEmail, userEmail });

    // Entferne Moderator
    await removeMember(libraryId, normalizeEmail(memberEmail));
    
    console.log('[API] DELETE /members: Moderator erfolgreich entfernt', { libraryId, memberEmail });

    return NextResponse.json({
      success: true,
      message: 'Moderator wurde erfolgreich entfernt',
    });
  } catch (error) {
    console.error('[API] Fehler beim Entfernen des Moderators:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

