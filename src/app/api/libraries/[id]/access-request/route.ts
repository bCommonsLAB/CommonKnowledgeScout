/**
 * @fileoverview Library Access Request API Route
 * 
 * @description
 * API endpoint for creating self-service access requests. Users can request
 * access to libraries that require authentication. Sends confirmation email
 * to user and notification emails to owner and moderators.
 * 
 * @module api
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { LibraryService } from '@/lib/services/library-service';
import { createAccessRequest, getAccessRequestByUserAndLibrary } from '@/lib/repositories/library-access-repo';
import { listMembers } from '@/lib/repositories/library-members-repo';
import { MailjetService } from '@/lib/services/mailjet-service';

/**
 * POST /api/libraries/[id]/access-request
 * Erstellt eine neue Zugriffsanfrage für einen angemeldeten Benutzer
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

    const userEmail = user.emailAddresses[0].emailAddress;
    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || userEmail;

    // Library laden und prüfen
    const libraryService = LibraryService.getInstance();
    
    // Finde Library über alle User-Libraries (Owner ist nicht bekannt)
    // Wir müssen die Library über getAllPublicLibraries finden oder einen anderen Weg
    // Für jetzt: Versuche Library über verschiedene User zu finden
    let library = null;
    try {
      // Versuche Library direkt zu laden (falls userEmail der Owner ist)
      library = await libraryService.getLibrary(userEmail, libraryId);
    } catch {
      // Library nicht gefunden - das ist OK, wir prüfen nur ob requiresAuth gesetzt ist
    }

    // Wenn Library nicht gefunden, versuche über public Libraries
    if (!library) {
      const publicLibraries = await libraryService.getAllPublicLibraries();
      library = publicLibraries.find(lib => lib.id === libraryId) || null;
    }

    if (!library) {
      return NextResponse.json(
        { error: 'Library nicht gefunden' },
        { status: 404 }
      );
    }

    // Prüfe ob requiresAuth aktiv ist
    if (!library.config?.publicPublishing?.requiresAuth) {
      return NextResponse.json(
        { error: 'Diese Library erfordert keine Zugriffsanfrage' },
        { status: 400 }
      );
    }

    // Prüfe ob Benutzer bereits Zugriff hat oder bereits angefragt hat
    const existingRequest = await getAccessRequestByUserAndLibrary(libraryId, userEmail);
    if (existingRequest) {
      if (existingRequest.status === 'approved') {
        return NextResponse.json(
          { error: 'Sie haben bereits Zugriff auf diese Library' },
          { status: 400 }
        );
      }
      if (existingRequest.status === 'pending') {
        return NextResponse.json(
          { error: 'Ihre Anfrage wird bereits bearbeitet' },
          { status: 400 }
        );
      }
    }

    // Erstelle neue Zugriffsanfrage
    const requestId = await createAccessRequest({
      libraryId,
      userEmail,
      userName,
      status: 'pending',
      source: 'self',
    });

    // Sende Bestätigungs-E-Mail an Benutzer
    await MailjetService.sendAccessRequestConfirmation(
      userEmail,
      userName,
      library.config.publicPublishing.publicName || library.label
    );

    // Finde Owner und Moderatoren für Benachrichtigung
    const libraryName = library.config.publicPublishing.publicName || library.label;
    
    // Owner finden: Durchsuche alle UserLibraries-Einträge
    const { getCollection } = await import('@/lib/mongodb-service');
    type UserLibraries = {
      email: string;
      name: string;
      libraries: Array<{ id: string }>;
      lastUpdated: Date;
    };
    const collectionName = process.env.MONGODB_COLLECTION_NAME || 'libraries';
    const collection = await getCollection<UserLibraries>(collectionName);
    const allEntries = await collection.find({}).toArray();
    
    let ownerEmail: string | null = null;
    for (const entry of allEntries) {
      if (entry.libraries && Array.isArray(entry.libraries)) {
        const foundLibrary = entry.libraries.find((lib: { id: string }) => lib.id === libraryId);
        if (foundLibrary) {
          ownerEmail = entry.email;
          break;
        }
      }
    }
    
    // Moderatoren: Aus Members-Collection
    const moderators = await listMembers(libraryId);
    const moderatorEmails = moderators
      .filter(m => m.role === 'moderator')
      .map(m => m.userEmail);

    // Sende Benachrichtigungen an Owner
    if (ownerEmail) {
      await MailjetService.sendAccessRequestNotificationToAdmin(
        ownerEmail,
        ownerEmail.split('@')[0], // Fallback für Name
        userEmail,
        userName,
        libraryName
      );
    }
    
    // Sende an alle Moderatoren
    for (const moderatorEmail of moderatorEmails) {
      const moderatorName = moderatorEmail.split('@')[0]; // Fallback
      
      await MailjetService.sendAccessRequestNotificationToAdmin(
        moderatorEmail,
        moderatorName,
        userEmail,
        userName,
        libraryName
      );
    }

    return NextResponse.json({
      success: true,
      requestId,
      message: 'Zugriffsanfrage wurde erfolgreich erstellt',
    });
  } catch (error) {
    console.error('[API] Fehler beim Erstellen der Zugriffsanfrage:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

