import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { StorageFactory } from '@/lib/storage/storage-factory';
import { LibraryService } from '@/lib/services/library-service';
import { OneDriveServerProvider } from '@/lib/storage/onedrive-provider-server';
import { ClientLibrary } from '@/types/library';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  let libraryId: string | undefined = undefined;
  let redirectUrl: string | undefined = undefined;
  const stateRaw = searchParams.get('state');
  if (stateRaw) {
    try {
      const stateObj = JSON.parse(stateRaw);
      libraryId = stateObj.libraryId;
      redirectUrl = stateObj.redirect;
    } catch {
      // Fallback: state ist nur die ID
      libraryId = stateRaw;
    }
  }
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const sessionState = searchParams.get('session_state');

  console.log(`[OneDrive Auth Callback] Received: code=${!!code}, libraryId=${libraryId}, error=${error}, sessionState=${!!sessionState}`);

  // Helper-Funktion um die korrekte Base-URL zu ermitteln
  const getBaseUrl = () => {
    // Prüfe zuerst Umgebungsvariable
    if (process.env.NEXT_PUBLIC_BASE_URL) {
      return process.env.NEXT_PUBLIC_BASE_URL;
    }
    
    // Extrahiere Base-URL aus MS_REDIRECT_URI
    if (process.env.MS_REDIRECT_URI) {
      try {
        const redirectUrl = new URL(process.env.MS_REDIRECT_URI);
        const baseUrl = `${redirectUrl.protocol}//${redirectUrl.host}`;
        console.log(`[OneDrive Auth Callback] Base-URL aus MS_REDIRECT_URI extrahiert: ${baseUrl}`);
        return baseUrl;
      } catch (error) {
        console.error('[OneDrive Auth Callback] Fehler beim Parsen von MS_REDIRECT_URI:', error);
      }
    }
    
    // Verwende Host-Header mit korrektem Protokoll
    const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    
    if (host) {
      return `${proto}://${host}`;
    }
    
    // Fallback auf request.url (nur als letzte Option)
    return new URL(request.url).origin;
  };

  const baseUrl = getBaseUrl();
  console.log(`[OneDrive Auth Callback] Using base URL: ${baseUrl}`);

  // Authentifizierung prüfen
  const { userId } = await auth();
  if (!userId) {
    console.error('[OneDrive Auth Callback] Nicht authentifiziert');
    return NextResponse.redirect(new URL('/signin', baseUrl));
  }

  // Benutzer-E-Mail abrufen
  const user = await currentUser();
  if (!user?.emailAddresses?.length) {
    console.error('[OneDrive Auth Callback] Keine E-Mail-Adresse gefunden');
    return NextResponse.redirect(new URL('/settings/storage?authError=no_email', baseUrl));
  }
  const userEmail = user.emailAddresses[0].emailAddress;

  // Fehlerbehandlung
  if (error) {
    console.error(`[OneDrive Auth Callback] Fehler: ${error}, Beschreibung: ${errorDescription}`);
    return NextResponse.redirect(new URL(`/settings/storage?authError=${error}&errorDescription=${encodeURIComponent(errorDescription || '')}`, baseUrl));
  }

  // Validierung der Parameter
  if (!code) {
    console.error('[OneDrive Auth Callback] Kein Code erhalten');
    return NextResponse.redirect(new URL('/settings/storage?authError=no_code', baseUrl));
  }

  if (!libraryId) {
    console.error('[OneDrive Auth Callback] Keine Library-ID erhalten');
    return NextResponse.redirect(new URL('/settings/storage?authError=no_library_id', baseUrl));
  }

  try {
    
    // Bibliotheksinformationen direkt über den LibraryService laden
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(userEmail);
    const library = libraries.find(lib => lib.id === libraryId);
    
    if (!library) {
      console.error(`[OneDrive Auth Callback] Bibliothek ${libraryId} nicht gefunden`);
      return NextResponse.redirect(new URL(`/settings/storage?authError=library_not_found&libraryId=${libraryId}`, baseUrl));
    }
    
    // WICHTIG: NICHT in ClientLibrary konvertieren!
    // Die ClientLibrary hat ein maskiertes Client Secret (********)
    // Wir brauchen aber das echte Secret für die Authentifizierung
    
    // Prüfen, ob es sich um eine OneDrive-Bibliothek handelt
    if (library.type !== 'onedrive') {
      console.error(`[OneDrive Auth Callback] Bibliothek ${libraryId} ist keine OneDrive-Bibliothek (Typ: ${library.type})`);
      return NextResponse.redirect(new URL(`/settings/storage?authError=invalid_library_type&libraryId=${libraryId}&libraryType=${library.type}`, baseUrl));
    }
    
    
    try {
      // Server-seitigen OneDrive-Provider mit der ORIGINALEN Library initialisieren
      // Die originale Library enthält das echte Client Secret
      const provider = new OneDriveServerProvider(library as unknown as ClientLibrary, userEmail);

             // Authentifizierung mit dem erhaltenen Code durchführen
       const authResult = await provider.authenticate(code);

       if (authResult) {
         console.log('[OneDrive Auth Callback] Authentifizierung erfolgreich');
         // StorageFactory Provider-Cache für diese ID löschen
         const factory = StorageFactory.getInstance();
         await factory.clearProvider(libraryId);
         
         // Nach erfolgreicher Authentifizierung zum ursprünglichen Ziel weiterleiten
         if (redirectUrl) {
           // Füge die libraryId als Query-Parameter zur Redirect-URL hinzu
           const url = new URL(redirectUrl, baseUrl);
           url.searchParams.set('activeLibraryId', libraryId);
           url.searchParams.set('authSuccess', 'true');
           url.searchParams.set('libraryId', libraryId);
           console.log('[OneDrive Auth Callback] Redirect mit Library-ID:', url.toString());
           
                       // Erstelle eine HTML-Seite, die das Popup schließt und eine Message an das ursprüngliche Fenster sendet
            // MIT DEN TOKENS (direkte Übertragung)
            const html = `
              <!DOCTYPE html>
              <html>
              <head>
                <title>Authentifizierung erfolgreich</title>
              </head>
              <body>
                <script>
                  // Sende Message an das ursprüngliche Fenster MIT TOKENS
                  if (window.opener) {
                    window.opener.postMessage({
                      type: 'OAUTH_SUCCESS',
                      libraryId: '${libraryId}',
                      redirectUrl: '${url.toString()}',
                      tokens: {
                        accessToken: '${authResult.accessToken}',
                        refreshToken: '${authResult.refreshToken}',
                        expiresIn: ${authResult.expiresIn}
                      }
                    }, '*');
                  }
                  
                  // Schließe das Popup-Fenster nach kurzer Verzögerung
                  setTimeout(() => {
                    window.close();
                  }, 1000);
                </script>
                <p>Authentifizierung erfolgreich! Das Fenster wird automatisch geschlossen...</p>
              </body>
              </html>
            `;
           
           return new NextResponse(html, {
             status: 200,
             headers: {
               'Content-Type': 'text/html',
             },
           });
         }
         return NextResponse.redirect(new URL(`/settings/storage?authSuccess=true&libraryId=${libraryId}`, baseUrl));
       } else {
        console.error('[OneDrive Auth Callback] Authentifizierung fehlgeschlagen');
        return NextResponse.redirect(new URL(`/settings/storage?authError=auth_failed&libraryId=${libraryId}`, baseUrl));
      }
    } catch (providerError) {
      console.error('[OneDrive Auth Callback] Fehler beim Initialisieren des Providers:', providerError);
      const errorMessage = providerError instanceof Error ? encodeURIComponent(providerError.message) : 'provider_error';
      return NextResponse.redirect(new URL(`/settings/storage?authError=${errorMessage}&libraryId=${libraryId}`, baseUrl));
    }
  } catch (error) {
    console.error('[OneDrive Auth Callback] Fehler bei der Authentifizierung:', error);
    const errorMessage = error instanceof Error ? encodeURIComponent(error.message) : 'unknown_error';
    return NextResponse.redirect(new URL(`/settings/storage?authError=${errorMessage}&libraryId=${libraryId}`, baseUrl));
  }
} 