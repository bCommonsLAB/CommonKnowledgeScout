import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * POST /api/secretary/process-image
 * Proxy-Endpunkt zum Secretary Service für Bild-OCR-Verarbeitung
 */
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

    // Library-ID aus Header extrahieren
    const libraryId = request.headers.get('X-Library-Id');
    if (!libraryId) {
      return NextResponse.json(
        { error: 'Library-ID erforderlich' },
        { status: 400 }
      );
    }

    // FormData vom Request extrahieren
    const formData = await request.formData();
    
    // Validierung der Eingabedaten
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json(
        { error: 'Keine Datei hochgeladen' },
        { status: 400 }
      );
    }

    const targetLanguage = formData.get('targetLanguage') as string;
    if (!targetLanguage) {
      return NextResponse.json(
        { error: 'Zielsprache erforderlich' },
        { status: 400 }
      );
    }

    const extractionMethod = formData.get('extraction_method') as string || 'ocr';
    const useCache = formData.get('useCache') as string || 'true';
    const context = formData.get('context') as string;

    console.log('[process-image] Request-Daten für Secretary Service:', {
      fileName: file.name,
      fileSize: file.size,
      targetLanguage,
      extractionMethod,
      useCache,
      hasContext: !!context,
      libraryId
    });

    // Secretary Service URL aus Umgebungsvariablen
    const env = process.env;
    if (!env.SECRETARY_SERVICE_URL) {
      console.error('[process-image] SECRETARY_SERVICE_URL nicht konfiguriert');
      return NextResponse.json(
        { error: 'Secretary Service nicht konfiguriert' },
        { status: 500 }
      );
    }

    const secretaryServiceUrl = env.SECRETARY_SERVICE_URL;
    const apiUrl = `${secretaryServiceUrl}/imageocr/process`;
    
    console.log('[process-image] Weiterleitung an Secretary Service:', apiUrl);
    
    // FormData für Secretary Service erstellen
    const secretaryFormData = new FormData();
    secretaryFormData.append('file', file);
    secretaryFormData.append('extraction_method', extractionMethod);
    secretaryFormData.append('useCache', useCache);
    
    // Context-Option
    if (context) {
      secretaryFormData.append('context', context);
    }
    
    // Anfrage an den Secretary Service senden
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: secretaryFormData,
      headers: {
        'Accept': 'application/json'
        // Content-Type wird automatisch gesetzt für FormData
      },
    });

    console.log('[process-image] Secretary Service Antwort:', {
      status: response.status,
      statusText: response.statusText
    });

    const data = await response.json();
    console.log('[process-image] Antwortdaten:', JSON.stringify(data).substring(0, 100) + '...');

    if (!response.ok) {
      console.error('[process-image] Secretary Service Fehler:', data);
      return NextResponse.json(
        { error: data.error || 'Fehler beim Transformieren der Bilddatei' },
        { status: response.status }
      );
    }

    // Gebe die vollständige Response zurück
    return NextResponse.json(data);
  } catch (error) {
    console.error('[process-image] Secretary Service Error:', error);
    return NextResponse.json(
      { error: 'Fehler bei der Verbindung zum Secretary Service' },
      { status: 500 }
    );
  }
} 