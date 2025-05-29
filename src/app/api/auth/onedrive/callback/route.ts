import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { StorageFactory } from '@/lib/storage/storage-factory';
import { LibraryService } from '@/lib/services/library-service';
import { OneDriveServerProvider } from '@/lib/storage/onedrive-provider-server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const libraryId = searchParams.get('state'); // Wir verwenden den state-Parameter, um die Library-ID zu übergeben
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const sessionState = searchParams.get('session_state');

  console.log(`[OneDrive Auth Callback] Received: code=${!!code}, libraryId=${libraryId}, error=${error}, sessionState=${!!sessionState}`);
  console.log(`[OneDrive Auth Callback] URL: ${request.url}`);

  // Debug-Ausgabe der Umgebungsvariablen
  console.log(`[OneDrive Auth Callback] Umgebungsvariablen:`, {
    MS_TENANT_ID: process.env.MS_TENANT_ID ? 'vorhanden' : 'nicht vorhanden',
    MS_CLIENT_ID: process.env.MS_CLIENT_ID ? 'vorhanden' : 'nicht vorhanden',
    MS_CLIENT_SECRET: process.env.MS_CLIENT_SECRET ? 'vorhanden' : 'nicht vorhanden',
    MS_REDIRECT_URI: process.env.MS_REDIRECT_URI ? 'vorhanden' : 'nicht vorhanden'
  });

  // Authentifizierung prüfen
  const { userId } = await auth();
  if (!userId) {
    console.error('[OneDrive Auth Callback] Nicht authentifiziert');
    return NextResponse.redirect(new URL('/signin', request.url));
  }

  // Benutzer-E-Mail abrufen
  const user = await currentUser();
  if (!user?.emailAddresses?.length) {
    console.error('[OneDrive Auth Callback] Keine E-Mail-Adresse gefunden');
    return NextResponse.redirect(new URL('/settings/storage?authError=no_email', request.url));
  }
  const userEmail = user.emailAddresses[0].emailAddress;

  // Fehlerbehandlung
  if (error) {
    console.error(`[OneDrive Auth Callback] Fehler: ${error}, Beschreibung: ${errorDescription}`);
    return NextResponse.redirect(new URL(`/settings/storage?authError=${error}&errorDescription=${encodeURIComponent(errorDescription || '')}`, request.url));
  }

  // Validierung der Parameter
  if (!code) {
    console.error('[OneDrive Auth Callback] Kein Code erhalten');
    return NextResponse.redirect(new URL('/settings/storage?authError=no_code', request.url));
  }

  if (!libraryId) {
    console.error('[OneDrive Auth Callback] Keine Library-ID erhalten');
    return NextResponse.redirect(new URL('/settings/storage?authError=no_library_id', request.url));
  }

  try {
    console.log(`[OneDrive Auth Callback] Lade Bibliotheksinformationen für ${libraryId}`);
    
    // Bibliotheksinformationen direkt über den LibraryService laden
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(userEmail);
    const library = libraries.find(lib => lib.id === libraryId);
    
    if (!library) {
      console.error(`[OneDrive Auth Callback] Bibliothek ${libraryId} nicht gefunden`);
      console.log(`[OneDrive Auth Callback] Verfügbare Bibliotheken:`, libraries.map(lib => ({
        id: lib.id,
        label: lib.label
      })));
      return NextResponse.redirect(new URL(`/settings/storage?authError=library_not_found&libraryId=${libraryId}`, request.url));
    }
    
    // Bibliothek in ClientLibrary konvertieren
    const clientLibrary = libraryService.toClientLibraries([library])[0];
    
    console.log(`[OneDrive Auth Callback] Bibliothek gefunden:`, {
      id: library.id,
      label: library.label,
      type: library.type
    });
    
    // Prüfen, ob es sich um eine OneDrive-Bibliothek handelt
    if (library.type !== 'onedrive') {
      console.error(`[OneDrive Auth Callback] Bibliothek ${libraryId} ist keine OneDrive-Bibliothek (Typ: ${library.type})`);
      return NextResponse.redirect(new URL(`/settings/storage?authError=invalid_library_type&libraryId=${libraryId}&libraryType=${library.type}`, request.url));
    }
    
    try {
      // Server-seitigen OneDrive-Provider initialisieren
      const provider = new OneDriveServerProvider(clientLibrary, userEmail);
      console.log(`[OneDrive Auth Callback] OneDriveServerProvider initialisiert`);

      // Authentifizierung mit dem erhaltenen Code durchführen
      console.log(`[OneDrive Auth Callback] Starte Authentifizierung mit Code`);
      const success = await provider.authenticate(code);

      if (success) {
        console.log('[OneDrive Auth Callback] Authentifizierung erfolgreich');
        // StorageFactory Provider-Cache für diese ID löschen
        const factory = StorageFactory.getInstance();
        await factory.clearProvider(libraryId);
        return NextResponse.redirect(new URL(`/settings/storage?authSuccess=true&libraryId=${libraryId}`, request.url));
      } else {
        console.error('[OneDrive Auth Callback] Authentifizierung fehlgeschlagen');
        return NextResponse.redirect(new URL(`/settings/storage?authError=auth_failed&libraryId=${libraryId}`, request.url));
      }
    } catch (providerError) {
      console.error('[OneDrive Auth Callback] Fehler beim Initialisieren des Providers:', providerError);
      const errorMessage = providerError instanceof Error ? encodeURIComponent(providerError.message) : 'provider_error';
      return NextResponse.redirect(new URL(`/settings/storage?authError=${errorMessage}&libraryId=${libraryId}`, request.url));
    }
  } catch (error) {
    console.error('[OneDrive Auth Callback] Fehler bei der Authentifizierung:', error);
    const errorMessage = error instanceof Error ? encodeURIComponent(error.message) : 'unknown_error';
    return NextResponse.redirect(new URL(`/settings/storage?authError=${errorMessage}&libraryId=${libraryId}`, request.url));
  }
} 