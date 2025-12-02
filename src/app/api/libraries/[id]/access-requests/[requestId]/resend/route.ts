/**
 * @fileoverview Resend Invitation API Route
 * 
 * @description
 * API endpoint for resending invitation emails. Allows owners and moderators
 * to resend invitation emails for pending access requests.
 * 
 * @module api
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getAccessRequestById, updateAccessRequestInviteToken } from '@/lib/repositories/library-access-repo';
import { isModeratorOrOwner } from '@/lib/repositories/library-members-repo';
import { LibraryService } from '@/lib/services/library-service';
import { MailjetService } from '@/lib/services/mailjet-service';
import crypto from 'crypto';

/**
 * POST /api/libraries/[id]/access-requests/[requestId]/resend
 * Versendet eine Einladungs-E-Mail erneut
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id: libraryId, requestId } = await params;

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
        { error: 'Keine Berechtigung. Nur Owner und Moderatoren können Einladungen erneut versenden.' },
        { status: 403 }
      );
    }

    // Access Request laden
    const accessRequest = await getAccessRequestById(requestId);
    if (!accessRequest) {
      return NextResponse.json(
        { error: 'Zugriffsanfrage nicht gefunden' },
        { status: 404 }
      );
    }

    // Prüfe ob es eine Einladung ist (nur Einladungen können erneut versendet werden)
    if (accessRequest.source !== 'moderatorInvite') {
      return NextResponse.json(
        { error: 'Nur Einladungen können erneut versendet werden' },
        { status: 400 }
      );
    }

    // Prüfe ob Library-ID übereinstimmt
    if (accessRequest.libraryId !== libraryId) {
      return NextResponse.json(
        { error: 'Zugriffsanfrage gehört nicht zu dieser Library' },
        { status: 400 }
      );
    }

    // Library-Informationen laden
    const libraryService = LibraryService.getInstance();
    const publicLibraries = await libraryService.getAllPublicLibraries();
    const library = publicLibraries.find(lib => lib.id === libraryId);

    if (!library) {
      return NextResponse.json(
        { error: 'Library nicht gefunden' },
        { status: 404 }
      );
    }

    // Verwende bestehenden Token oder generiere neuen
    let inviteToken = accessRequest.inviteToken;
    
    // Wenn kein Token vorhanden, generiere neuen und speichere ihn
    if (!inviteToken) {
      inviteToken = crypto.randomBytes(32).toString('base64url');
      await updateAccessRequestInviteToken(requestId, inviteToken);
    }

    // Erstelle Invite-URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const inviteUrl = `${appUrl}/invite/${inviteToken}`;

    // Sende Einladungs-E-Mail erneut
    const libraryName = library.config?.publicPublishing?.publicName || library.label;
    const inviterName = accessRequest.invitedBy || userEmail;
    
    await MailjetService.sendInviteEmail(
      accessRequest.userEmail,
      accessRequest.userName,
      libraryName,
      inviteUrl,
      inviterName,
      undefined // Persönliche Nachricht wird beim erneuten Versenden nicht mitgesendet
    );

    console.log(`[API] Einladung für ${accessRequest.userEmail} erneut versendet von ${userEmail}`);

    return NextResponse.json({
      success: true,
      message: 'Einladung wurde erfolgreich erneut versendet',
    });
  } catch (error) {
    console.error('[API] Fehler beim erneuten Versenden der Einladung:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

