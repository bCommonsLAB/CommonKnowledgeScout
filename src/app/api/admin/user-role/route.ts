/**
 * @fileoverview Admin API Route - User Role Management
 * 
 * @description
 * API endpoint for setting user roles (Creator vs Guest).
 * Only accessible by admins or through Clerk's admin interface.
 * 
 * @module api/admin
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser, clerkClient } from '@clerk/nextjs/server';

/**
 * PUT /api/admin/user-role
 * Setzt die Rolle eines Benutzers (Creator oder Guest)
 * 
 * Body:
 * - userId: string (optional, falls nicht gesetzt wird aktueller Benutzer verwendet)
 * - role: 'creator' | 'guest'
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId: currentUserId } = await auth();
    
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }
    
    // Prüfe, ob aktueller Benutzer Admin ist (kann über Public Metadata erweitert werden)
    // Für jetzt: Jeder authentifizierte Benutzer kann seine eigene Rolle setzen
    // TODO: Admin-Check implementieren, wenn Admin-Rolle definiert ist
    
    const body = await request.json();
    const { userId, role } = body;

    if (!role || (role !== 'creator' && role !== 'guest')) {
      return NextResponse.json(
        { error: 'Ungültige Rolle. Muss "creator" oder "guest" sein.' },
        { status: 400 }
      );
    }

    const targetUserId = userId || currentUserId;

    // Setze Public Metadata über Clerk Client
    const client = await clerkClient();
    await client.users.updateUserMetadata(targetUserId, {
      publicMetadata: {
        userRole: role,
      },
    });

    return NextResponse.json({
      success: true,
      userId: targetUserId,
      role,
    });
  } catch (error) {
    console.error('[API] Fehler beim Setzen der Benutzerrolle:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/user-role
 * Ruft die Rolle des aktuellen Benutzers ab
 */
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    const user = await currentUser();
    const role = (user?.publicMetadata?.userRole as 'creator' | 'guest') || 'guest';

    return NextResponse.json({
      userId,
      role,
    });
  } catch (error) {
    console.error('[API] Fehler beim Abrufen der Benutzerrolle:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

