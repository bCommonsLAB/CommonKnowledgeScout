/**
 * @fileoverview Library Invite Accept API Route
 * 
 * @description
 * API endpoint for accepting library invitations. Invited user must be
 * authenticated and their email must match the invitation. Automatically
 * approves the access request upon acceptance.
 * 
 * @module api
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getAccessRequestByInviteToken, updateAccessRequestStatus } from '@/lib/repositories/library-access-repo';
import { LibraryService } from '@/lib/services/library-service';
import { MailjetService } from '@/lib/services/mailjet-service';

/**
 * POST /api/libraries/invites/[token]/accept
 * Nimmt eine Einladung an (nur für authentifizierte Benutzer)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Authentifizierung prüfen
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

    // Access Request über Token finden
    const accessRequest = await getAccessRequestByInviteToken(token);
    if (!accessRequest) {
      return NextResponse.json(
        { error: 'Einladung nicht gefunden oder bereits verwendet' },
        { status: 404 }
      );
    }

    // Prüfe ob E-Mail übereinstimmt
    if (accessRequest.userEmail !== userEmail) {
      return NextResponse.json(
        { 
          error: 'Diese Einladung ist für eine andere E-Mail-Adresse bestimmt',
          expectedEmail: accessRequest.userEmail,
          currentEmail: userEmail,
        },
        { status: 403 }
      );
    }

    // Prüfe ob bereits genehmigt
    if (accessRequest.status === 'approved') {
      return NextResponse.json({
        success: true,
        message: 'Einladung wurde bereits angenommen',
        libraryId: accessRequest.libraryId,
      });
    }

    // Status auf approved setzen
    const reviewedBy = accessRequest.invitedBy || 'system';
    const success = await updateAccessRequestStatus(
      accessRequest.id,
      'approved',
      reviewedBy
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Fehler beim Akzeptieren der Einladung' },
        { status: 500 }
      );
    }

    // Library-Informationen für E-Mail laden
    const libraryService = LibraryService.getInstance();
    const publicLibraries = await libraryService.getAllPublicLibraries();
    const library = publicLibraries.find(lib => lib.id === accessRequest.libraryId);
    const libraryName = library?.config?.publicPublishing?.publicName || library?.label || 'Library';
    const librarySlug = library?.config?.publicPublishing?.slugName || '';

    // Sende Bestätigungs-E-Mail
    await MailjetService.sendAccessApprovedEmail(
      userEmail,
      accessRequest.userName,
      libraryName,
      librarySlug
    );

    return NextResponse.json({
      success: true,
      message: 'Einladung wurde erfolgreich angenommen',
      libraryId: accessRequest.libraryId,
      librarySlug,
    });
  } catch (error) {
    console.error('[API] Fehler beim Akzeptieren der Einladung:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

