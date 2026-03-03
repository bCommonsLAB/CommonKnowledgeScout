/**
 * @fileoverview Member Invite Accept API Route
 * 
 * @description
 * API endpoint fuer das Akzeptieren von Mitglieder-Einladungen.
 * Der eingeladene Benutzer muss authentifiziert sein und seine E-Mail
 * muss mit der Einladung uebereinstimmen.
 * 
 * @module api
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getMemberByInviteToken, acceptMemberInvite } from '@/lib/repositories/library-members-repo';
import { LibraryService } from '@/lib/services/library-service';
import { normalizeEmail } from '@/lib/auth/user-email';

/**
 * POST /api/member-invites/[token]/accept
 * Nimmt eine Mitglieder-Einladung an (nur fuer authentifizierte Benutzer)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Authentifizierung pruefen
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Bitte melden Sie sich an, um die Einladung anzunehmen' },
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

    // Mitglied ueber Token finden
    const member = await getMemberByInviteToken(token);
    if (!member) {
      return NextResponse.json(
        { error: 'Einladung nicht gefunden oder bereits verwendet' },
        { status: 404 }
      );
    }

    // E-Mail-Validierung (case-insensitive)
    const normalizedUserEmail = normalizeEmail(userEmail);
    const normalizedMemberEmail = normalizeEmail(member.userEmail);
    if (normalizedUserEmail !== normalizedMemberEmail) {
      return NextResponse.json(
        {
          error: 'Diese Einladung ist fuer eine andere E-Mail-Adresse bestimmt',
          expectedEmail: member.userEmail,
          currentEmail: userEmail,
        },
        { status: 403 }
      );
    }

    // Bereits aktiv?
    if (member.status === 'active') {
      return NextResponse.json({
        success: true,
        message: 'Einladung wurde bereits angenommen',
        libraryId: member.libraryId,
      });
    }

    // Einladung annehmen (status -> active)
    const updatedMember = await acceptMemberInvite(token, userEmail);
    if (!updatedMember) {
      return NextResponse.json(
        { error: 'Fehler beim Akzeptieren der Einladung' },
        { status: 500 }
      );
    }

    // Library-Info fuer die Antwort laden
    const libraryService = LibraryService.getInstance();
    const library = await libraryService.getLibraryById(member.libraryId);
    const librarySlug = library?.config?.publicPublishing?.slugName || '';
    const roleLabel = member.role === 'co-creator' ? 'Co-Creator' : 'Moderator';

    console.log(`[API] Mitglieder-Einladung akzeptiert: ${userEmail} als ${roleLabel} fuer Library ${member.libraryId}`);

    return NextResponse.json({
      success: true,
      message: `Sie sind jetzt ${roleLabel} der Library`,
      libraryId: member.libraryId,
      librarySlug,
      role: member.role,
      // Typ-Marker, damit die Invite-Seite weiss, dass es eine Mitglieder-Einladung war
      inviteType: 'member',
    });
  } catch (error) {
    console.error('[API] Fehler beim Akzeptieren der Mitglieder-Einladung:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}
