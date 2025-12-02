/**
 * @fileoverview Accept Pending Invites API Route
 * 
 * @description
 * API endpoint for automatically accepting all pending invitations for the current user.
 * This is called after successful login/registration to handle cases where the invite
 * token was lost during the authentication flow.
 * 
 * @module api
 */

import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getPendingInvitesByEmail, updateAccessRequestStatus } from '@/lib/repositories/library-access-repo';
import { LibraryService } from '@/lib/services/library-service';
import { MailjetService } from '@/lib/services/mailjet-service';

/**
 * POST /api/user/accept-pending-invites
 * Akzeptiert automatisch alle ausstehenden Einladungen für den aktuellen Benutzer
 */
export async function POST() {
  try {
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
    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || userEmail;

    // Alle ausstehenden Einladungen für diese E-Mail finden
    const pendingInvites = await getPendingInvitesByEmail(userEmail);
    
    if (pendingInvites.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Keine ausstehenden Einladungen gefunden',
        acceptedCount: 0,
        libraries: [],
      });
    }

    // Library-Informationen laden
    const libraryService = LibraryService.getInstance();
    const publicLibraries = await libraryService.getAllPublicLibraries();
    
    const acceptedLibraries: Array<{ id: string; slug: string | null; label: string }> = [];
    const errors: Array<{ id: string; error: string }> = [];

    // Alle Einladungen akzeptieren
    for (const invite of pendingInvites) {
      try {
        // Status auf approved setzen
        const reviewedBy = invite.invitedBy || 'system';
        const success = await updateAccessRequestStatus(
          invite.id,
          'approved',
          reviewedBy
        );

        if (!success) {
          errors.push({ id: invite.id, error: 'Fehler beim Aktualisieren des Status' });
          continue;
        }

        // Library-Informationen finden
        const library = publicLibraries.find(lib => lib.id === invite.libraryId);
        if (library) {
          acceptedLibraries.push({
            id: library.id,
            slug: library.config?.publicPublishing?.slugName || null,
            label: library.config?.publicPublishing?.publicName || library.label,
          });

          // E-Mail-Benachrichtigung senden (optional, kann auch weggelassen werden)
          try {
            const libraryName = library.config?.publicPublishing?.publicName || library.label;

            await MailjetService.sendAccessRequestConfirmation(
              userEmail,
              userName,
              libraryName
            );
          } catch (emailError) {
            // E-Mail-Fehler nicht kritisch, nur loggen
            console.error('[API] Fehler beim Senden der Bestätigungs-E-Mail:', emailError);
          }
        }
      } catch (err) {
        console.error(`[API] Fehler beim Akzeptieren der Einladung ${invite.id}:`, err);
        errors.push({
          id: invite.id,
          error: err instanceof Error ? err.message : 'Unbekannter Fehler',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${acceptedLibraries.length} Einladung(en) erfolgreich akzeptiert`,
      acceptedCount: acceptedLibraries.length,
      libraries: acceptedLibraries,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[API] Fehler beim Akzeptieren ausstehender Einladungen:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

