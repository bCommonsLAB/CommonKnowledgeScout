import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { LibraryService } from '@/lib/services/library-service';

export async function POST(request: NextRequest) {
  try {
    // Authentifizierung prüfen
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    // Request-Body parsen
    const body = await request.json();
    const { libraryId, refreshToken } = body;

    if (!libraryId || !refreshToken) {
      return NextResponse.json(
        { error: 'Fehlende Parameter: libraryId oder refreshToken' },
        { status: 400 }
      );
    }

    // Benutzer-E-Mail abrufen
    const user = await currentUser();
    if (!user?.emailAddresses?.length) {
      return NextResponse.json(
        { error: 'Keine E-Mail-Adresse gefunden' },
        { status: 400 }
      );
    }
    const userEmail = user.emailAddresses[0].emailAddress;

    // Bibliothek laden
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(userEmail);
    const library = libraries.find(lib => lib.id === libraryId);

    if (!library) {
      return NextResponse.json(
        { error: `Bibliothek ${libraryId} nicht gefunden` },
        { status: 404 }
      );
    }

    // Prüfen, ob es eine OneDrive-Bibliothek ist
    if (library.type !== 'onedrive') {
      return NextResponse.json(
        { error: `Bibliothek ${libraryId} ist keine OneDrive-Bibliothek` },
        { status: 400 }
      );
    }

    // OAuth-Konfiguration aus der Bibliothek laden
    const tenantId = library.config?.tenantId || 'common';
    const clientId = library.config?.clientId;
    const clientSecret = library.config?.clientSecret;
    const redirectUri = process.env.MS_REDIRECT_URI || '';

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Fehlende OAuth-Konfiguration in der Bibliothek' },
        { status: 400 }
      );
    }

    // Token-Refresh bei Microsoft durchführen
    console.log('[OneDrive Refresh] Führe Token-Refresh durch für Library:', libraryId);
    
    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: clientId as string,
      client_secret: clientSecret as string,
      refresh_token: refreshToken,
      redirect_uri: redirectUri,
      grant_type: 'refresh_token',
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[OneDrive Refresh] Token-Refresh fehlgeschlagen:', errorData);
      return NextResponse.json(
        { 
          error: 'Token-Refresh fehlgeschlagen',
          details: errorData.error_description || errorData.error
        },
        { status: 400 }
      );
    }

    const tokenData = await response.json();
    console.log('[OneDrive Refresh] Token erfolgreich erneuert');

    // Neue Tokens in der Datenbank speichern
    const expiryTime = Math.floor(Date.now() / 1000) + tokenData.expires_in;
    
    const updatedConfig = {
      ...(library.config || {}),
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiry: expiryTime.toString()
    };

    const updatedLibrary = {
      ...library,
      config: updatedConfig
    };

    const success = await libraryService.updateLibrary(userEmail, updatedLibrary);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Fehler beim Speichern der neuen Tokens' },
        { status: 500 }
      );
    }

    // Erfolgreiche Response mit neuen Tokens
    return NextResponse.json({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in
    });

  } catch (error) {
    console.error('[OneDrive Refresh] Unerwarteter Fehler:', error);
    return NextResponse.json(
      { 
        error: 'Interner Serverfehler',
        details: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
} 