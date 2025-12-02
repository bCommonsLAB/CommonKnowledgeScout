/**
 * @fileoverview Library Invites API Route
 * 
 * @description
 * API endpoint for creating moderator invitations. Owners and moderators can
 * invite users by email. Creates an access request with invite token that
 * can be accepted by the invited user.
 * 
 * @module api
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createAccessRequest, getAccessRequestByUserAndLibrary } from '@/lib/repositories/library-access-repo';
import { isModeratorOrOwner } from '@/lib/repositories/library-members-repo';
import { LibraryService } from '@/lib/services/library-service';
import { MailjetService } from '@/lib/services/mailjet-service';
import crypto from 'crypto';

/**
 * POST /api/libraries/[id]/invites
 * Erstellt eine Einladung für einen Benutzer per E-Mail
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
    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json(
        { error: 'Keine E-Mail-Adresse gefunden' },
        { status: 401 }
      );
    }

    const inviterEmail = user.emailAddresses[0].emailAddress;
    const inviterName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || inviterEmail;

    // Prüfe ob Benutzer Owner oder Moderator ist
    const hasPermission = await isModeratorOrOwner(libraryId, inviterEmail);
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Keine Berechtigung. Nur Owner und Moderatoren können Einladungen versenden.' },
        { status: 403 }
      );
    }

    // Request Body parsen
    const body = await request.json().catch(() => ({}));
    const { email: invitedEmail, name: invitedName, inviteMessage } = body;

    // Validierung
    if (!invitedEmail || typeof invitedEmail !== 'string') {
      return NextResponse.json(
        { error: 'E-Mail-Adresse ist erforderlich' },
        { status: 400 }
      );
    }

    // Prüfe ob eingeladener Benutzer bereits Zugriff hat
    const existingRequest = await getAccessRequestByUserAndLibrary(libraryId, invitedEmail);
    if (existingRequest && existingRequest.status === 'approved') {
      return NextResponse.json(
        { error: 'Dieser Benutzer hat bereits Zugriff auf die Library' },
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

    // Generiere Invite-Token
    const inviteToken = crypto.randomBytes(32).toString('base64url');

    // Erstelle Access Request mit Invite-Token
    const requestId = await createAccessRequest({
      libraryId,
      userEmail: invitedEmail,
      userName: invitedName || invitedEmail.split('@')[0],
      status: 'pending',
      source: 'moderatorInvite',
      invitedBy: inviterEmail,
      inviteToken,
    });

    // Erstelle Invite-URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const inviteUrl = `${appUrl}/invite/${inviteToken}`;

    // Sende Einladungs-E-Mail
    const libraryName = library.config?.publicPublishing?.publicName || library.label;
    await MailjetService.sendInviteEmail(
      invitedEmail,
      invitedName || invitedEmail.split('@')[0],
      libraryName,
      inviteUrl,
      inviterName,
      inviteMessage || undefined
    );

    return NextResponse.json({
      success: true,
      requestId,
      inviteToken,
      inviteUrl,
      message: 'Einladung wurde erfolgreich versendet',
    });
  } catch (error) {
    console.error('[API] Fehler beim Erstellen der Einladung:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

