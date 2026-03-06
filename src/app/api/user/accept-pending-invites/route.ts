/**
 * @fileoverview Pending Invites API Route
 *
 * @description
 * GET  – Liefert alle ausstehenden Einladungen (Member + Access-Requests) für den aktuellen Benutzer.
 * POST – Akzeptiert oder lehnt eine einzelne Einladung ab.
 *        Body: { libraryId: string, type: 'member' | 'access-request', action: 'accept' | 'decline' }
 *
 * Wird vom useAutoAcceptInvites-Hook beim App-Start aufgerufen,
 * um dem Benutzer einen Dialog zur Annahme/Ablehnung anzuzeigen.
 *
 * @module api
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getPendingInvitesByEmail, updateAccessRequestStatus } from '@/lib/repositories/library-access-repo';
import {
  getPendingMembersByEmail,
  acceptMemberByEmail,
  declineMemberByEmail,
} from '@/lib/repositories/library-members-repo';
import { LibraryService } from '@/lib/services/library-service';

/** Einheitliches Format für ausstehende Einladungen (Client-seitig) */
export interface PendingInvite {
  libraryId: string;
  libraryLabel: string;
  role: string;
  invitedBy: string;
  invitedAt: string;
  /** 'member' = Co-Creator/Moderator, 'access-request' = Reader */
  type: 'member' | 'access-request';
}

/**
 * GET /api/user/accept-pending-invites
 * Liefert alle ausstehenden Einladungen ohne sie zu verändern.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    const user = await currentUser();
    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json({ error: 'Keine E-Mail-Adresse gefunden' }, { status: 401 });
    }

    const userEmail = user.emailAddresses[0].emailAddress;
    const libraryService = LibraryService.getInstance();
    const invites: PendingInvite[] = [];

    // Member-Einladungen (Co-Creator / Moderator)
    const pendingMembers = await getPendingMembersByEmail(userEmail);
    for (const m of pendingMembers) {
      const lib = await libraryService.getLibraryById(m.libraryId);
      invites.push({
        libraryId: m.libraryId,
        libraryLabel: lib?.label || m.libraryId,
        role: m.role,
        invitedBy: m.addedBy || 'Unbekannt',
        invitedAt: m.addedAt ? new Date(m.addedAt).toISOString() : new Date().toISOString(),
        type: 'member',
      });
    }

    // Access-Request-Einladungen (Reader)
    const pendingAccess = await getPendingInvitesByEmail(userEmail);
    for (const a of pendingAccess) {
      const lib = await libraryService.getLibraryById(a.libraryId);
      invites.push({
        libraryId: a.libraryId,
        libraryLabel: lib?.label || a.libraryId,
        role: 'reader',
        invitedBy: a.invitedBy || 'Unbekannt',
        invitedAt: a.requestedAt ? new Date(a.requestedAt).toISOString() : new Date().toISOString(),
        type: 'access-request',
      });
    }

    return NextResponse.json({ invites });
  } catch (error) {
    console.error('[API] Fehler beim Laden ausstehender Einladungen:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/accept-pending-invites
 * Akzeptiert oder lehnt eine einzelne Einladung ab.
 * Body: { libraryId, type, action }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    const user = await currentUser();
    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json({ error: 'Keine E-Mail-Adresse gefunden' }, { status: 401 });
    }

    const userEmail = user.emailAddresses[0].emailAddress;

    const body = await request.json().catch(() => ({}));
    const { libraryId, type, action } = body as {
      libraryId?: string;
      type?: 'member' | 'access-request';
      action?: 'accept' | 'decline';
    };

    if (!libraryId || !type || !action) {
      return NextResponse.json(
        { error: 'libraryId, type und action sind erforderlich' },
        { status: 400 }
      );
    }

    let success = false;

    if (type === 'member') {
      if (action === 'accept') {
        success = await acceptMemberByEmail(libraryId, userEmail);
      } else {
        success = await declineMemberByEmail(libraryId, userEmail);
      }
    } else if (type === 'access-request') {
      // Access-Request-ID über libraryId + userEmail finden
      const pendingAccess = await getPendingInvitesByEmail(userEmail);
      const match = pendingAccess.find(a => a.libraryId === libraryId);
      if (match) {
        const status = action === 'accept' ? 'approved' : 'rejected';
        const reviewedBy = match.invitedBy || 'self';
        success = await updateAccessRequestStatus(match.id, status, reviewedBy);
      }
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Einladung konnte nicht verarbeitet werden' },
        { status: 404 }
      );
    }

    const label = action === 'accept' ? 'akzeptiert' : 'abgelehnt';
    console.log(`[API] Einladung ${label}: ${userEmail} → ${libraryId} (${type})`);

    // Bei Accept: Library-Infos zurückgeben für Navigation
    if (action === 'accept') {
      const libraryService = LibraryService.getInstance();
      const lib = await libraryService.getLibraryById(libraryId);
      return NextResponse.json({
        success: true,
        action,
        library: lib ? {
          id: lib.id,
          slug: lib.config?.publicPublishing?.slugName || null,
          label: lib.label,
        } : null,
      });
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error('[API] Fehler beim Verarbeiten der Einladung:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}
