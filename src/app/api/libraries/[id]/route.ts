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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: libraryId } = await params;
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

  if (!libraryId) {
    return NextResponse.json({ error: 'Keine Bibliotheks-ID angegeben' }, { status: 400 });
  }

  try {
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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: libraryId } = await params;
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
    
    // Config verarbeiten - maskierte Secrets filtern
    let processedConfig = updatedClientLibrary.config;
    if (processedConfig && existingLibrary.config) {
      // Kopiere die existierende Config
      processedConfig = { ...existingLibrary.config };
      
      // Übernehme nur nicht-maskierte Werte aus der neuen Config
      for (const [key, value] of Object.entries(updatedClientLibrary.config)) {
        if (key === 'clientSecret' && value === '********') {
          // Maskiertes Secret ignorieren, existierenden Wert behalten
          console.log(`[API] PUT: Ignoriere maskiertes clientSecret`);
          continue;
        }
        // Alle anderen Werte übernehmen
        processedConfig[key] = value;
      }
    }
    
    // Bibliotheksdaten aktualisieren
    // Wir konvertieren nicht die gesamte ClientLibrary, sondern übernehmen nur die Felder,
    // die tatsächlich geändert werden sollen
    const updatedLibrary: Library = {
      ...existingLibrary,
      label: updatedClientLibrary.label || existingLibrary.label,
      type: updatedClientLibrary.type || existingLibrary.type,
      config: processedConfig || existingLibrary.config,
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

/**
 * PATCH /api/libraries/[id]
 * Aktualisiert teilweise eine vorhandene Bibliothek anhand ihrer ID
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: libraryId } = await params;
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

  if (!libraryId) {
    return NextResponse.json({ error: 'Keine Bibliotheks-ID angegeben' }, { status: 400 });
  }

  try {
    // Daten aus dem Request-Body lesen
    const patchData = await request.json();
    
    console.log(`[API] === PATCH START ===`);
    console.log(`[API] PATCH /libraries/${libraryId} für Benutzer ${userEmail}`);
    console.log(`[API] Request Body:`, JSON.stringify(patchData, null, 2));
    console.log(`[API] Config Keys:`, patchData.config ? Object.keys(patchData.config) : []);
    if (patchData.config?.clientSecret) {
      console.log(`[API] ClientSecret im Request:`, {
        value: patchData.config.clientSecret,
        length: patchData.config.clientSecret.length,
        isMasked: patchData.config.clientSecret === '********'
      });
    }

    // Bibliotheken des Benutzers laden
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(userEmail);
    
    // Gesuchte Bibliothek finden
    const existingLibrary = libraries.find(lib => lib.id === libraryId);
    
    if (!existingLibrary) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 });
    }
    
    // Debug: Zeige existierende Config
    console.log(`[API] Existierende Config:`, {
      hasClientSecret: !!existingLibrary.config?.clientSecret,
      clientSecretValue: existingLibrary.config?.clientSecret,
      hasWebDAVUrl: !!existingLibrary.config?.url,
      hasWebDAVUsername: !!existingLibrary.config?.username,
      hasWebDAVPassword: !!existingLibrary.config?.password,
      hasWebDAVBasePath: !!existingLibrary.config?.basePath,
      configKeys: existingLibrary.config ? Object.keys(existingLibrary.config) : []
    });
    
    // Config-Updates vorbereiten
    const updatedConfig: Record<string, unknown> = { ...(existingLibrary.config || {}) };
    
    if (patchData.config) {
      // Für jedes Feld in der neuen Config
      for (const [key, value] of Object.entries(patchData.config)) {
        console.log(`[API] Verarbeite Config-Feld: ${key} = ${key === 'clientSecret' ? '[REDACTED]' : value}`);
        
        // Spezielle Behandlung für clientSecret
        if (key === 'clientSecret') {
          // Ignoriere maskierte Werte (********)
          if (value === '********') {
            console.log(`[API] Ignoriere maskiertes clientSecret`);
            // Behalte den existierenden Wert (falls vorhanden)
            continue;
          }
          // Nur aktualisieren, wenn ein neuer Wert (nicht leer) gesendet wurde
          if (value && value !== '') {
            console.log(`[API] Aktualisiere clientSecret mit neuem Wert (Länge: ${(value as string).length})`);
            updatedConfig[key] = value;
          } else {
            console.log(`[API] Behalte existierendes clientSecret (leerer Wert gesendet)`);
          }
          // Wenn leer, behalten wir den existierenden Wert
        } else if (key === 'password') {
          // WebDAV-Passwort wird nicht mehr maskiert - normale Behandlung
          console.log(`[API] Aktualisiere WebDAV password (Länge: ${value ? (value as string).length : 0})`);
          updatedConfig[key] = value;
        } else {
          // Alle anderen Felder normal aktualisieren
          updatedConfig[key] = value;
        }
      }
    }
    
    // Debug: Zeige finale Config
    console.log(`[API] Finale Config vor Update:`, {
      hasClientSecret: !!updatedConfig.clientSecret,
      clientSecretValue: updatedConfig.clientSecret === '********' ? 'MASKED' : 
                         updatedConfig.clientSecret ? 'SET' : 'NOT SET',
      hasWebDAVUrl: !!updatedConfig.url,
      hasWebDAVUsername: !!updatedConfig.username,
      hasWebDAVPassword: !!updatedConfig.password,
      hasWebDAVBasePath: !!updatedConfig.basePath,
      configKeys: Object.keys(updatedConfig)
    });
    
    // Bibliotheksdaten aktualisieren
    const updatedLibrary: Library = {
      ...existingLibrary,
      type: patchData.type || existingLibrary.type,
      path: patchData.path !== undefined ? patchData.path : existingLibrary.path,
      config: updatedConfig,
    };
    
    console.log(`[API] Rufe updateLibrary auf...`);
    
    // Bibliothek aktualisieren
    const success = await libraryService.updateLibrary(userEmail, updatedLibrary);
    
    if (!success) {
      return NextResponse.json({ error: 'Fehler beim Aktualisieren der Bibliothek' }, { status: 500 });
    }
    
    console.log(`[API] Update erfolgreich, erstelle Client-Response...`);
    
    // Aktualisierte Bibliothek zurückgeben
    const updatedClientLibraryResult = libraryService.toClientLibraries([updatedLibrary])[0];
    
    console.log(`[API] Client-Response:`, {
      hasClientSecret: !!updatedClientLibraryResult.config?.clientSecret,
      clientSecretValue: updatedClientLibraryResult.config?.clientSecret,
      hasWebDAVUrl: !!updatedClientLibraryResult.config?.url,
      hasWebDAVUsername: !!updatedClientLibraryResult.config?.username,
      hasWebDAVPassword: !!updatedClientLibraryResult.config?.password,
      hasWebDAVBasePath: !!updatedClientLibraryResult.config?.basePath
    });
    console.log(`[API] === PATCH END ===`);
    
    return NextResponse.json(updatedClientLibraryResult);
  } catch (error) {
    console.error(`[API] Fehler beim Aktualisieren der Bibliothek ${libraryId}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
} 