/**
 * @fileoverview Library Members API Route
 * 
 * @description
 * API endpoint for managing library members (moderators, co-creators).
 * Only owners can add/remove members.
 * Beim Hinzufuegen wird eine Einladungs-E-Mail versendet (status: pending).
 * 
 * @module api
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { addMember, removeMember, listMembers, updateMemberInviteToken } from '@/lib/repositories/library-members-repo';
import { LibraryService } from '@/lib/services/library-service';
import { MailjetService } from '@/lib/services/mailjet-service';
import { getPreferredUserEmail, normalizeEmail } from '@/lib/auth/user-email';

/**
 * GET /api/libraries/[id]/members
 * Listet alle Mitglieder einer Library (pending + active)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: libraryId } = await params;

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

    // Nur Owner koennen Mitglieder sehen
    const libraryService = LibraryService.getInstance();
    try {
      await libraryService.getLibrary(userEmail, libraryId);
    } catch {
      return NextResponse.json(
        { error: 'Keine Berechtigung. Nur Owner koennen Mitglieder verwalten.' },
        { status: 403 }
      );
    }

    const members = await listMembers(libraryId);

    return NextResponse.json({ members });
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
 * Laedt ein Mitglied (Moderator oder Co-Creator) per E-Mail-Einladung ein.
 * 
 * Body: { email: string, role: 'moderator' | 'co-creator' }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: libraryId } = await params;

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

    // Nur Owner koennen Mitglieder einladen
    const libraryService = LibraryService.getInstance();
    let library;
    try {
      library = await libraryService.getLibrary(userEmail, libraryId);
    } catch {
      return NextResponse.json(
        { error: 'Keine Berechtigung. Nur Owner koennen Mitglieder einladen.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { email: memberEmail, role } = body;

    if (!memberEmail || typeof memberEmail !== 'string') {
      return NextResponse.json(
        { error: 'E-Mail-Adresse ist erforderlich' },
        { status: 400 }
      );
    }

    if (role !== 'moderator' && role !== 'co-creator') {
      return NextResponse.json(
        { error: 'Ungueltige Rolle. Erlaubt sind "moderator" und "co-creator".' },
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

    const normalizedUserEmail = normalizeEmail(userEmail);

    // Man kann sich nicht selbst als Mitglied einladen
    if (normalizedMemberEmail === normalizedUserEmail) {
      return NextResponse.json(
        { error: 'Sie koennen sich nicht selbst als Mitglied einladen.' },
        { status: 400 }
      );
    }

    // Mitglied anlegen (status: pending) und Token erhalten
    const inviteToken = await addMember(libraryId, normalizedMemberEmail, role, userEmail);

    // Einladungs-E-Mail senden
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const inviteUrl = `${appUrl}/invite/${inviteToken}`;
    const libraryName = library?.label || 'Library';
    const inviterName = user?.fullName || user?.firstName || userEmail;

    const emailSent = await MailjetService.sendMemberInviteEmail(
      normalizedMemberEmail,
      memberEmail.trim(),
      libraryName,
      role,
      inviteUrl,
      inviterName
    );

    const roleLabel = role === 'co-creator' ? 'Co-Creator' : 'Moderator';

    if (!emailSent) {
      console.warn('[API] Einladungs-E-Mail konnte nicht gesendet werden, Einladung wurde trotzdem erstellt.');
    }

    return NextResponse.json({
      success: true,
      message: emailSent
        ? `Einladung als ${roleLabel} wurde an ${normalizedMemberEmail} gesendet.`
        : `Einladung als ${roleLabel} wurde erstellt, E-Mail konnte jedoch nicht gesendet werden.`,
      emailSent,
    });
  } catch (error) {
    console.error('[API] Fehler beim Einladen des Mitglieds:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/libraries/[id]/members
 * Sendet die Einladungs-E-Mail erneut (nur fuer pending Members).
 * 
 * Body: { email: string }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: libraryId } = await params;

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

    // Nur Owner koennen erneut senden
    const libraryService = LibraryService.getInstance();
    let library;
    try {
      library = await libraryService.getLibrary(userEmail, libraryId);
    } catch {
      return NextResponse.json(
        { error: 'Keine Berechtigung.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { email: memberEmail } = body;

    if (!memberEmail || typeof memberEmail !== 'string') {
      return NextResponse.json(
        { error: 'E-Mail-Adresse ist erforderlich' },
        { status: 400 }
      );
    }

    // Neuen Token generieren
    const newToken = await updateMemberInviteToken(libraryId, memberEmail);
    if (!newToken) {
      return NextResponse.json(
        { error: 'Keine ausstehende Einladung fuer diese E-Mail-Adresse gefunden.' },
        { status: 404 }
      );
    }

    // E-Mail erneut senden
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const inviteUrl = `${appUrl}/invite/${newToken}`;
    const libraryName = library?.label || 'Library';
    const inviterName = user?.fullName || user?.firstName || userEmail;

    // Rolle aus der DB holen (wir wissen sie nicht aus dem Request)
    const members = await listMembers(libraryId);
    const member = members.find(m => normalizeEmail(m.userEmail) === normalizeEmail(memberEmail));
    const role = member?.role || 'co-creator';

    const emailSent = await MailjetService.sendMemberInviteEmail(
      normalizeEmail(memberEmail),
      memberEmail.trim(),
      libraryName,
      role,
      inviteUrl,
      inviterName
    );

    return NextResponse.json({
      success: true,
      message: emailSent
        ? `Einladung wurde erneut an ${memberEmail} gesendet.`
        : `Neuer Token wurde erstellt, E-Mail konnte jedoch nicht gesendet werden.`,
      emailSent,
    });
  } catch (error) {
    console.error('[API] Fehler beim erneuten Senden der Einladung:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/libraries/[id]/members
 * Entfernt ein Mitglied aus einer Library
 * 
 * Query: ?email=user@example.com
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: libraryId } = await params;

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

    // Nur Owner koennen Mitglieder entfernen
    const libraryService = LibraryService.getInstance();
    try {
      await libraryService.getLibrary(userEmail, libraryId);
    } catch {
      return NextResponse.json(
        { error: 'Keine Berechtigung. Nur Owner koennen Mitglieder entfernen.' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const memberEmail = searchParams.get('email');

    if (!memberEmail) {
      return NextResponse.json(
        { error: 'E-Mail-Adresse ist erforderlich' },
        { status: 400 }
      );
    }

    await removeMember(libraryId, normalizeEmail(memberEmail));

    return NextResponse.json({
      success: true,
      message: 'Mitglied wurde erfolgreich entfernt',
    });
  } catch (error) {
    console.error('[API] Fehler beim Entfernen des Mitglieds:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}
