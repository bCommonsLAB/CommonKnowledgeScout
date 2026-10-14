import { NextRequest, NextResponse } from 'next/server';
import { LibraryService } from '@/lib/services/library-service';
import { formatiereChatKonfigurationFehler, mergeChatKonfiguration, validiereChatKonfiguration } from '@/lib/services/chat-config-validation';
import { auth, currentUser } from '@clerk/nextjs/server';
import { ClientLibrary, Library } from '@/types/library';
import { LEGACY_STORAGE_FIELDS } from '@/lib/storage-connections/migration-plan';

/**
 * Speicher-Zugangsdaten gehoeren seit Teil A an die Speicher-Verbindung der
 * Person, nicht in die Library-Config. Kommt eines dieser Felder trotzdem,
 * wird es laut abgewiesen statt still gespeichert oder ignoriert.
 */
function legacyStorageFieldsIn(config: unknown): string[] {
  if (!config || typeof config !== 'object') return [];
  return LEGACY_STORAGE_FIELDS.filter((feld) => (config as Record<string, unknown>)[feld] !== undefined);
}

function legacyStorageFieldsResponse(felder: string[]): NextResponse {
  return NextResponse.json(
    { error: `Zugangsdaten (${felder.join(', ')}) gehoeren an eine Speicher-Verbindung (Mein Konto → Speicher-Verbindungen), nicht in die Library-Config.` },
    { status: 400 },
  );
}

/**
 * GET /api/libraries/[id]
 * Ruft eine einzelne Bibliothek anhand ihrer ID ab
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log(`\n=== [API-GET] START ===`);
  console.log(`[API-GET] Request URL: ${request.url}`);
  
  const { id: libraryId } = await params;
  console.log(`[API-GET] Library ID: ${libraryId}`);
  
  // Benutzerauthentifizierung überprüfen
  console.log(`[API-GET] Calling auth()...`);
  const { userId } = await auth();
  console.log(`[API-GET] auth() result: ${userId ? `${userId.substring(0, 8)}...` : 'null'}`);
  
  if (!userId) {
    console.log(`[API-GET] ❌ No userId, returning 401`);
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  // Benutzer-E-Mail abrufen
  console.log(`[API-GET] Calling currentUser()...`);
  const user = await currentUser();
  console.log(`[API-GET] currentUser() result:`, {
    hasUser: !!user,
    emailCount: user?.emailAddresses?.length || 0
  });
  
  if (!user?.emailAddresses?.length) {
    console.log(`[API-GET] ❌ No email addresses, returning 401`);
    return NextResponse.json({ error: 'Keine E-Mail-Adresse gefunden' }, { status: 401 });
  }
  const userEmail = user.emailAddresses[0].emailAddress;
  console.log(`[API-GET] ✅ User email: ${userEmail.split('@')[0]}@...`);

  if (!libraryId) {
    console.log(`[API-GET] ❌ No libraryId, returning 400`);
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
    console.log(`[API-GET] ✅ Returning library data`);
    console.log(`[API-GET] === GET END ===\n`);
    return NextResponse.json(clientLibrary);
  } catch (error) {
    console.error(`[API-GET] ❌ Fehler beim Abrufen der Bibliothek ${libraryId}:`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3) : 'No stack'
    });
    console.log(`[API-GET] === GET END (ERROR) ===\n`);
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
    
    // Config verarbeiten
    let processedConfig = updatedClientLibrary.config;
    if (processedConfig && existingLibrary.config) {
      // Kopiere die existierende Config
      processedConfig = { ...existingLibrary.config };
      
      // Speicher-Zugangsdaten liegen an der Speicher-Verbindung (Teil A)
      const altfelder = legacyStorageFieldsIn(updatedClientLibrary.config);
      if (altfelder.length > 0) return legacyStorageFieldsResponse(altfelder);
      for (const [key, value] of Object.entries(updatedClientLibrary.config)) {
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
  console.log(`\n=== [API-PATCH] START ===`);
  console.log(`[API-PATCH] Request URL: ${request.url}`);
  console.log(`[API-PATCH] Method: ${request.method}`);
  console.log(`[API-PATCH] Headers:`, {
    'content-type': request.headers.get('content-type'),
    'user-agent': request.headers.get('user-agent')?.substring(0, 50),
    'cookie': request.headers.get('cookie') ? 'Present' : 'Missing',
    'authorization': request.headers.get('authorization') ? 'Present' : 'Missing'
  });

  const { id: libraryId } = await params;
  console.log(`[API-PATCH] Library ID from params: ${libraryId}`);
  
  // Benutzerauthentifizierung überprüfen
  console.log(`[API-PATCH] Calling auth()...`);
  
  let userId;
  try {
    const authResult = await auth();
    userId = authResult.userId;
    console.log(`[API-PATCH] auth() result:`, {
      hasUserId: !!userId,
      userId: userId ? `${userId.substring(0, 8)}...` : null
    });
  } catch (authError) {
    console.error(`[API-PATCH] ❌ auth() failed:`, {
      name: authError instanceof Error ? authError.name : 'Unknown',
      message: authError instanceof Error ? authError.message : 'Unknown error',
      stack: authError instanceof Error ? authError.stack?.split('\n').slice(0, 3) : 'No stack'
    });
    throw authError;
  }
  
  if (!userId) {
    console.log(`[API-PATCH] ❌ No userId, returning 401`);
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  // Benutzer-E-Mail abrufen
  console.log(`[API-PATCH] Calling currentUser()...`);
  
  let user;
  try {
    user = await currentUser();
    console.log(`[API-PATCH] currentUser() result:`, {
      hasUser: !!user,
      userId: user?.id ? `${user.id.substring(0, 8)}...` : null,
      emailCount: user?.emailAddresses?.length || 0
    });
  } catch (userError) {
    console.error(`[API-PATCH] ❌ currentUser() failed:`, {
      name: userError instanceof Error ? userError.name : 'Unknown',
      message: userError instanceof Error ? userError.message : 'Unknown error',
      stack: userError instanceof Error ? userError.stack?.split('\n').slice(0, 3) : 'No stack'
    });
    throw userError;
  }
  
  if (!user?.emailAddresses?.length) {
    console.log(`[API-PATCH] ❌ No email addresses, returning 401`);
    return NextResponse.json({ error: 'Keine E-Mail-Adresse gefunden' }, { status: 401 });
  }
  const userEmail = user.emailAddresses[0].emailAddress;
  console.log(`[API-PATCH] ✅ User email: ${userEmail.split('@')[0]}@...`);

  if (!libraryId) {
    return NextResponse.json({ error: 'Keine Bibliotheks-ID angegeben' }, { status: 400 });
  }

  try {
    // Daten aus dem Request-Body lesen
    const patchData = await request.json();
    
    console.log(`[API] === PATCH START ===`);
    console.log(`[API] PATCH /libraries/${libraryId} für Benutzer ${userEmail}`);
    // Kein Request-Body im Log: er kann Geheimnisse tragen (Secretary-Key u. a.).
    console.log(`[API] Config Keys:`, patchData.config ? Object.keys(patchData.config) : []);
    const altfelder = legacyStorageFieldsIn(patchData.config);
    if (altfelder.length > 0) return legacyStorageFieldsResponse(altfelder);

    // Bibliotheken des Benutzers laden
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(userEmail);
    
    // Gesuchte Bibliothek finden
    const existingLibrary = libraries.find(lib => lib.id === libraryId);
    
    if (!existingLibrary) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 });
    }
    
    // Config-Updates vorbereiten
    const updatedConfig: Record<string, unknown> = { ...(existingLibrary.config || {}) };
    
    if (patchData.config) {
      // Für jedes Feld in der neuen Config
      for (const [key, value] of Object.entries(patchData.config)) {
        console.log(`[API] Verarbeite Config-Feld: ${key}`);
        if (key === 'chat' && value && typeof value === 'object' && !Array.isArray(value)) {
          // Spezielle Behandlung für chat-Config: Merge statt Überschreiben —
          // und seit Welle D dieselbe Pruefung wie im Formular (chat-config-validation.ts):
          // ein Platzhalter auf eine unbekannte Facette darf nicht gespeichert werden,
          // sonst steht der Chat der Library beim naechsten Lesen.
          const existingChat = updatedConfig[key] as Record<string, unknown> | undefined
          const gemergt = mergeChatKonfiguration(existingChat, value as Record<string, unknown>)
          const pruefung = validiereChatKonfiguration(gemergt)
          if (!pruefung.ok) {
            return NextResponse.json({ error: formatiereChatKonfigurationFehler(pruefung.fehler) }, { status: 400 })
          }
          updatedConfig[key] = gemergt
          console.log(`[API] Gemergte chat-Config`, { 
            existingKeys: existingChat ? Object.keys(existingChat) : [],
            newKeys: Object.keys(value as Record<string, unknown>),
          })
        } else if (key === 'ingestionStorage' && value && typeof value === 'object' && !Array.isArray(value)) {
          // Merge: leerer connectionString überschreibt gespeichertes Secret nicht (wie Nextcloud appPassword)
          const existingIng = updatedConfig[key] as Record<string, unknown> | undefined;
          const inc = value as Record<string, unknown>;
          const merged: Record<string, unknown> = { ...(existingIng || {}), ...inc };
          const incCs = inc.connectionString;
          if (typeof incCs !== 'string' || !incCs.trim()) {
            if (existingIng?.connectionString && typeof existingIng.connectionString === 'string') {
              merged.connectionString = existingIng.connectionString;
            }
          }
          updatedConfig[key] = merged;
        } else {
          // Alle anderen Felder normal aktualisieren
          updatedConfig[key] = value;
        }
      }
    }
    
    // Bibliotheksdaten aktualisieren
    // Speicher-Verbindung (Teil A): String setzt, null loest die Bindung,
    // undefined laesst sie unberuehrt.
    const connectionPatch = patchData.storageConnectionId
    const storageConnectionId =
      typeof connectionPatch === 'string' && connectionPatch.trim() !== ''
        ? connectionPatch.trim()
        : connectionPatch === null
          ? undefined
          : existingLibrary.storageConnectionId;
    const updatedLibrary: Library = {
      ...existingLibrary,
      type: patchData.type || existingLibrary.type,
      path: patchData.path !== undefined ? patchData.path : existingLibrary.path,
      storageConnectionId,
      config: updatedConfig,
    };
    if (storageConnectionId === undefined) delete updatedLibrary.storageConnectionId;
    
    console.log(`[API] Rufe updateLibrary auf...`);
    
    // Bibliothek aktualisieren
    const success = await libraryService.updateLibrary(userEmail, updatedLibrary);
    
    if (!success) {
      return NextResponse.json({ error: 'Fehler beim Aktualisieren der Bibliothek' }, { status: 500 });
    }
    
    console.log(`[API] Update erfolgreich, erstelle Client-Response...`);
    
    // Aktualisierte Bibliothek zurückgeben
    const updatedClientLibraryResult = libraryService.toClientLibraries([updatedLibrary])[0];
    
    console.log(`[API-PATCH] === PATCH END ===\n`);
    
    return NextResponse.json(updatedClientLibraryResult);
  } catch (error) {
    console.error(`[API-PATCH] ❌ Fehler beim Aktualisieren der Bibliothek ${libraryId}:`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : 'No stack'
    });
    console.log(`[API-PATCH] === PATCH END (ERROR) ===\n`);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
} 