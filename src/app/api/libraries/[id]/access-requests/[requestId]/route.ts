/**
 * @fileoverview Library Access Request Update API Route
 * 
 * @description
 * API endpoint for updating access request status (approve/reject).
 * Only accessible by library owners and moderators.
 * 
 * @module api
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getAccessRequestById, updateAccessRequestStatus, deleteAccessRequest } from '@/lib/repositories/library-access-repo';
import { isModeratorOrOwner } from '@/lib/repositories/library-members-repo';
import { LibraryService } from '@/lib/services/library-service';
import { MailjetService } from '@/lib/services/mailjet-service';
import type { AccessRequestStatus } from '@/types/library-access';

/**
 * PUT /api/libraries/[id]/access-requests/[requestId]
 * Aktualisiert den Status einer Zugriffsanfrage (approve/reject)
 */
export async function PUT(
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
        { error: 'Keine Berechtigung' },
        { status: 403 }
      );
    }

    // Request Body parsen
    const body = await request.json().catch(() => ({}));
    const { status } = body;

    // Validierung
    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json(
        { error: 'Ungültiger Status. Erlaubt: approved, rejected' },
        { status: 400 }
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

    // Prüfe ob Request zur Library gehört
    if (accessRequest.libraryId !== libraryId) {
      return NextResponse.json(
        { error: 'Zugriffsanfrage gehört nicht zu dieser Library' },
        { status: 400 }
      );
    }

    // Status aktualisieren
    const success = await updateAccessRequestStatus(
      requestId,
      status as AccessRequestStatus,
      userEmail
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Fehler beim Aktualisieren des Status' },
        { status: 500 }
      );
    }

    // Library-Informationen für E-Mail laden
    const libraryService = LibraryService.getInstance();
    const publicLibraries = await libraryService.getAllPublicLibraries();
    const library = publicLibraries.find(lib => lib.id === libraryId);
    const libraryName = library?.config?.publicPublishing?.publicName || library?.label || 'Library';
    const librarySlug = library?.config?.publicPublishing?.slugName || '';

    // E-Mail an Benutzer senden
    if (status === 'approved') {
      await MailjetService.sendAccessApprovedEmail(
        accessRequest.userEmail,
        accessRequest.userName,
        libraryName,
        librarySlug
      );
    } else if (status === 'rejected') {
      await MailjetService.sendAccessRejectedEmail(
        accessRequest.userEmail,
        accessRequest.userName,
        libraryName
      );
    }

    return NextResponse.json({
      success: true,
      message: `Zugriffsanfrage wurde ${status === 'approved' ? 'genehmigt' : 'abgelehnt'}`,
    });
  } catch (error) {
    console.error('[API] Fehler beim Aktualisieren der Zugriffsanfrage:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/libraries/[id]/access-requests/[requestId]
 * Löscht eine Zugriffsanfrage
 */
export async function DELETE(
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
        { error: 'Keine Berechtigung' },
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

    // Prüfe ob Request zur Library gehört
    if (accessRequest.libraryId !== libraryId) {
      return NextResponse.json(
        { error: 'Zugriffsanfrage gehört nicht zu dieser Library' },
        { status: 400 }
      );
    }

    // Zugriffsanfrage löschen
    const success = await deleteAccessRequest(requestId);
    if (!success) {
      return NextResponse.json(
        { error: 'Fehler beim Löschen der Zugriffsanfrage' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Zugriffsanfrage wurde erfolgreich gelöscht',
    });
  } catch (error) {
    console.error('[API] Fehler beim Löschen der Zugriffsanfrage:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

