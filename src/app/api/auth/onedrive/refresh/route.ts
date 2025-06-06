import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';

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

    // Benutzer-E-Mail abrufen
    const user = await currentUser();
    if (!user?.emailAddresses?.length) {
      return NextResponse.json(
        { error: 'Keine E-Mail-Adresse gefunden' },
        { status: 400 }
      );
    }

    // Request-Body parsen
    const body = await request.json();
    const { refreshToken, libraryId, tenantId, clientId, clientSecret, redirectUri } = body;

    if (!refreshToken || !tenantId || !clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { error: 'Fehlende Parameter für Token-Refresh' },
        { status: 400 }
      );
    }

    console.log('[OneDrive Token Refresh] Starte Token-Refresh für Bibliothek:', libraryId);

    // Token-Refresh bei Microsoft durchführen
    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
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
      console.error('[OneDrive Token Refresh] Fehler:', errorData);
      return NextResponse.json(
        { 
          error: 'Token-Refresh fehlgeschlagen',
          details: errorData.error_description || errorData.error
        },
        { status: response.status }
      );
    }

    const tokenData = await response.json();
    console.log('[OneDrive Token Refresh] Token erfolgreich erneuert');

    // Neue Tokens zurückgeben
    return NextResponse.json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in
    });

  } catch (error) {
    console.error('[OneDrive Token Refresh] Unerwarteter Fehler:', error);
    return NextResponse.json(
      { 
        error: 'Interner Serverfehler',
        details: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
} 