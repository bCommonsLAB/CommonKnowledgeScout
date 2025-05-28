import { NextRequest, NextResponse } from 'next/server';
import { LibraryService } from '@/lib/services/library-service';
import { auth, currentUser } from '@clerk/nextjs/server';
import { ClientLibrary, Library } from '@/types/library';

/**
 * GET /api/libraries/[id]
 * Ruft eine einzelne Bibliothek anhand ihrer ID ab
 */
export async function GET(
  request: NextRequest,
  // @ts-expect-error - Next.js 15 App Router params typing issue
  { params }
) {
  // Benutzerauthentifizierung überprüfen
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  // Benutzer-E-Mail abrufen
  const user = await currentUser();
  if (!user?.emailAddresses?.length) {
    return NextResponse.json({ error: 'Keine E-Mail-Adresse gefunden' }, { status: 401 });
  }
  const userEmail = user.emailAddresses[0].emailAddress;

  // Bibliotheks-ID aus Parametern
  const libraryId = params.id;
  if (!libraryId) {
    return NextResponse.json({ error: 'Keine Bibliotheks-ID angegeben' }, { status: 400 });
  }

  try {
    console.log(`[API] GET /libraries/${libraryId} für Benutzer ${userEmail}`);
    
    // Bibliotheken des Benutzers laden
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(userEmail);
    
    // Gesuchte Bibliothek finden
    const library = libraries.find(lib => lib.id === libraryId);
    
    if (!library) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 });
    }
    
    // Bibliothek in Client-Format umwandeln und zurückgeben
    const clientLibrary = libraryService.toClientLibraries([library])[0];
    return NextResponse.json(clientLibrary);
  } catch (error) {
    console.error(`[API] Fehler beim Abrufen der Bibliothek ${libraryId}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/libraries/[id]
 * Aktualisiert eine vorhandene Bibliothek anhand ihrer ID
 */
export async function PUT(
  request: NextRequest,
  // @ts-expect-error - Next.js 15 App Router params typing issue
  { params }
) {
  // Benutzerauthentifizierung überprüfen
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  // Benutzer-E-Mail abrufen
  const user = await currentUser();
  if (!user?.emailAddresses?.length) {
    return NextResponse.json({ error: 'Keine E-Mail-Adresse gefunden' }, { status: 401 });
  }
  const userEmail = user.emailAddresses[0].emailAddress;

  // Bibliotheks-ID aus Parametern
  const libraryId = params.id;
  if (!libraryId) {
    return NextResponse.json({ error: 'Keine Bibliotheks-ID angegeben' }, { status: 400 });
  }

  try {
    // Daten aus dem Request-Body lesen
    const updatedClientLibrary = await request.json() as ClientLibrary;
    
    if (updatedClientLibrary.id !== libraryId) {
      return NextResponse.json({ error: 'Bibliotheks-ID stimmt nicht überein' }, { status: 400 });
    }
    
    console.log(`[API] PUT /libraries/${libraryId} für Benutzer ${userEmail}`);

    // Bibliotheken des Benutzers laden
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(userEmail);
    
    // Gesuchte Bibliothek finden
    const existingLibrary = libraries.find(lib => lib.id === libraryId);
    
    if (!existingLibrary) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 });
    }
    
    // Bibliotheksdaten aktualisieren
    // Wir konvertieren nicht die gesamte ClientLibrary, sondern übernehmen nur die Felder,
    // die tatsächlich geändert werden sollen
    const updatedLibrary: Library = {
      ...existingLibrary,
      label: updatedClientLibrary.label || existingLibrary.label,
      type: updatedClientLibrary.type || existingLibrary.type,
      config: updatedClientLibrary.config || existingLibrary.config,
      // Weitere Felder, die aktualisiert werden sollen...
    };
    
    // Bibliothek aktualisieren
    const success = await libraryService.updateLibrary(userEmail, updatedLibrary);
    
    if (!success) {
      return NextResponse.json({ error: 'Fehler beim Aktualisieren der Bibliothek' }, { status: 500 });
    }
    
    // Aktualisierte Bibliothek zurückgeben
    const updatedClientLibraryResult = libraryService.toClientLibraries([updatedLibrary])[0];
    return NextResponse.json(updatedClientLibraryResult);
  } catch (error) {
    console.error(`[API] Fehler beim Aktualisieren der Bibliothek ${libraryId}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
} 