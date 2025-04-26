import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { LibraryService } from '@/lib/services/library-service';
import { cookies } from 'next/headers';

// Importiere die Umgebungsvariablen
const env = {
  SECRETARY_SERVICE_URL: process.env.SECRETARY_SERVICE_URL || '',
  SECRETARY_SERVICE_API_KEY: process.env.SECRETARY_SERVICE_API_KEY || ''
};

/**
 * API-Route für den Track-Processor des Secretary Service
 * 
 * Unterstützt folgende Endpunkte:
 * - GET /api/secretary/tracks/available - Liste verfügbarer Tracks
 * - POST /api/secretary/tracks/{track_name}/summary - Zusammenfassung eines Tracks erstellen
 * - POST /api/secretary/tracks/star/summarize_all - Zusammenfassung aller Tracks erstellen
 */

// Hilfsfunktion zum Abrufen der aktiven Bibliotheks-ID
async function getActiveLibraryId(): Promise<string | null> {
  // Im Server-Kontext: Hole die Bibliotheks-ID aus dem Cookie
  const cookieStore = await cookies();
  const libraryId = cookieStore.get('library_id')?.value || 
                    cookieStore.get('activeLibraryId')?.value; // Alternativ
  
  console.log('[secretary/tracks] Aktive Bibliothek aus Cookie:', libraryId || 'nicht gefunden');
  return libraryId || null;
}

type RouteParams = {
  params: {
    track: string[]
  }
};

export async function GET(
  req: NextRequest,
  context: RouteParams
) {
  try {
    // Extrahiere die Parameter manuell und sicherer
    const trackParams = await context.params.track || [];
    const trackPath = trackParams.join('/');
    
    // Auth prüfen
    const { userId } = getAuth(req);
    if (!userId) {
      console.log('[secretary/tracks] Nicht authentifiziert');
      return NextResponse.json({ 
        status: 'error', 
        error: { 
          code: 'AuthError',
          message: 'Nicht authentifiziert'
        } 
      }, { status: 401 });
    }
    
    // Aktive Bibliotheks-ID abrufen
    const activeLibraryId = await getActiveLibraryId();
    console.log('[secretary/tracks] Aktive Bibliotheks-ID:', activeLibraryId);
    if (!activeLibraryId) {
      return NextResponse.json({ 
        status: 'error', 
        error: { 
          code: 'ConfigError',
          message: 'Keine aktive Bibliothek ausgewählt'
        } 
      }, { status: 400 });
    }

    const apiUrl = env.SECRETARY_SERVICE_URL;
    const apiKey = env.SECRETARY_SERVICE_API_KEY;
    console.log('[secretary/tracks] API-URL vorhanden:', !!apiUrl, ' API-Key vorhanden:', !!apiKey);

    if (!apiUrl || !apiKey) {
      return NextResponse.json({ 
        status: 'error', 
        error: { 
          code: 'ConfigError',
          message: 'Secretary Service API-URL oder API-Key nicht konfiguriert'
        } 
      }, { status: 400 });
    }
    
    console.log('[secretary/tracks] Track-Pfad:', trackPath);
    
    // Zusammenstellung der Track-Processor API URL
    let targetUrl = `${apiUrl}/tracks/${trackPath}`;
    
    // URL-Parameter aus der Anfrage übernehmen
    const searchParams = req.nextUrl.searchParams;
    if (searchParams.toString()) {
      targetUrl += `?${searchParams.toString()}`;
    }

    console.log(`[secretary/tracks] GET-Anfrage an: ${targetUrl}`);

    // Anfrage an den Secretary Service weiterleiten
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Library-Id': activeLibraryId
      }
    });

    const data = await response.json();
    console.log(`[secretary/tracks] Antwort erhalten, Status: ${response.status}`);
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[secretary/tracks] Fehler bei GET-Anfrage:', error);
    return NextResponse.json({ 
      status: 'error', 
      error: { 
        code: 'ServerError',
        message: 'Fehler bei der Kommunikation mit dem Secretary Service'
      } 
    }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: RouteParams
) {
  try {
    // Extrahiere die Parameter manuell und sicherer
    const trackParams = await context.params.track || [];
    const trackPath = trackParams.join('/');
    
    // Auth prüfen
    const { userId } = getAuth(req);
    if (!userId) {
      console.log('[secretary/tracks] Nicht authentifiziert');
      return NextResponse.json({ 
        status: 'error', 
        error: { 
          code: 'AuthError',
          message: 'Nicht authentifiziert'
        } 
      }, { status: 401 });
    }
    
    // Aktive Bibliotheks-ID abrufen
    const activeLibraryId = await getActiveLibraryId();
    console.log('[secretary/tracks] Aktive Bibliotheks-ID:', activeLibraryId);
    if (!activeLibraryId) {
    /*  return NextResponse.json({ 
        status: 'error', 
        error: { 
          code: 'ConfigError',
          message: 'Keine aktive Bibliothek ausgewählt'
        } 
      }, { status: 400 });
      */
    }

    const apiUrl = env.SECRETARY_SERVICE_URL;
    const apiKey = env.SECRETARY_SERVICE_API_KEY;
    
    console.log('[secretary/tracks] API-URL vorhanden:', !!apiUrl, ' API-Key vorhanden:', !!apiKey);

    if (!apiUrl || !apiKey) {
      return NextResponse.json({ 
        status: 'error', 
        error: { 
          code: 'ConfigError',
          message: 'Secretary Service API-URL oder API-Key nicht konfiguriert'
        } 
      }, { status: 400 });
    }

    // Body der Anfrage lesen
    const requestBody = await req.json();
    console.log('[secretary/tracks] Request-Body:', JSON.stringify(requestBody));
    
    console.log('[secretary/tracks] Track-Pfad:', trackPath);
    
    // Zusammenstellung der Track-Processor API URL
    let targetUrl = `${apiUrl}/tracks/${trackPath}`;
    
    // URL-Parameter aus der Anfrage übernehmen
    const searchParams = req.nextUrl.searchParams;
    if (searchParams.toString()) {
      targetUrl += `?${searchParams.toString()}`;
    }

    console.log(`[secretary/tracks] POST-Anfrage an: ${targetUrl}`);

    // Anfrage an den Secretary Service weiterleiten
    const headers: HeadersInit = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    console.log(`[secretary/tracks] Antwort erhalten, Status: ${response.status}, Daten:`, 
                JSON.stringify(data).substring(0, 500) + '...');
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[secretary/tracks] Fehler bei POST-Anfrage:', error);
    return NextResponse.json({ 
      status: 'error', 
      error: { 
        code: 'ServerError',
        message: 'Fehler bei der Kommunikation mit dem Secretary Service'
      } 
    }, { status: 500 });
  }
} 