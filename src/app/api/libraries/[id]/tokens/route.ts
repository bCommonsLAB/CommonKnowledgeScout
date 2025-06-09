import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { StorageFactory } from '@/lib/storage/storage-factory';
import { LibraryService } from '@/lib/services/library-service';

/**
 * GET /api/libraries/[id]/tokens
 * Gibt den Authentifizierungsstatus einer Bibliothek zurück
 * OHNE die eigentlichen Tokens preiszugeben
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentifizierung prüfen
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    // Library-ID aus den Parametern extrahieren
    const { id } = await params;
    
    // Da wir Tokens nur noch im localStorage speichern (Client-seitig),
    // kann der Server den Token-Status nicht direkt prüfen.
    // Wir geben daher immer false zurück und lassen den Client
    // den tatsächlichen Status aus localStorage ermitteln.
    
    console.log(`[API] GET /libraries/${id}/tokens - Server kann localStorage nicht prüfen`);
    
    return NextResponse.json({
      isAuthenticated: false,
      isExpired: false,
      message: 'Token-Status muss client-seitig aus localStorage geprüft werden'
    });
  } catch (error) {
    console.error('[API] Fehler beim Abrufen des Token-Status:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

// DELETE - Tokens löschen (Abmelden)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentifizierung prüfen
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    // Library-ID aus den Parametern extrahieren
    const { id } = await params;
    console.log(`[API] DELETE /libraries/${id}/tokens - Cache wird geleert`);
    
    // StorageFactory Provider-Cache für diese ID löschen
    const factory = StorageFactory.getInstance();
    await factory.clearProvider(id);
    
    console.log('[API] Provider-Cache erfolgreich geleert');
    
    // Hinweis: Die eigentlichen Tokens werden client-seitig aus localStorage gelöscht
    
    return NextResponse.json({ 
      success: true,
      message: 'Provider-Cache geleert. Tokens müssen client-seitig aus localStorage gelöscht werden.'
    });
  } catch (error) {
    console.error('[API] Fehler beim Löschen der Tokens:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

// POST - Temporäre Tokens abrufen und löschen
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentifizierung prüfen
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    // Benutzer-E-Mail abrufen
    const user = await currentUser();
    if (!user?.emailAddresses?.length) {
      return NextResponse.json({ error: 'Keine E-Mail-Adresse gefunden' }, { status: 400 });
    }
    const userEmail = user.emailAddresses[0].emailAddress;

    // Library-ID aus den Parametern extrahieren
    const { id } = await params;
    console.log(`[API] POST /libraries/${id}/tokens - Temporäre Tokens abrufen`);

    // Bibliothek abrufen
    const libraryService = LibraryService.getInstance();
    const library = await libraryService.getLibrary(userEmail, id);
    
    if (!library) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 });
    }

    // Prüfen ob temporäre Tokens vorhanden sind
    const config = library.config as Record<string, unknown>;
    const tempAccessToken = config?.tempAccessToken as string;
    const tempRefreshToken = config?.tempRefreshToken as string;
    const tempTokenExpiry = config?.tempTokenExpiry as string;
    const tempTokensAvailable = config?.tempTokensAvailable as boolean;

    if (!tempTokensAvailable || !tempAccessToken || !tempRefreshToken) {
      return NextResponse.json({ 
        error: 'Keine temporären Tokens verfügbar',
        hasTokens: false 
      }, { status: 404 });
    }

    // Tokens aus der Konfiguration entfernen
    const updatedConfig = { ...config };
    delete updatedConfig.tempAccessToken;
    delete updatedConfig.tempRefreshToken;
    delete updatedConfig.tempTokenExpiry;
    delete updatedConfig.tempTokensAvailable;

    // Bibliothek ohne temporäre Tokens speichern
    const updatedLibrary = {
      ...library,
      config: updatedConfig
    };

    await libraryService.updateLibrary(userEmail, updatedLibrary);
    
    console.log('[API] Temporäre Tokens erfolgreich abgerufen und aus DB gelöscht');
    
    // Tokens an Client zurückgeben
    return NextResponse.json({ 
      success: true,
      tokens: {
        accessToken: tempAccessToken,
        refreshToken: tempRefreshToken,
        tokenExpiry: tempTokenExpiry
      }
    });
  } catch (error) {
    console.error('[API] Fehler beim Abrufen der temporären Tokens:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
} 