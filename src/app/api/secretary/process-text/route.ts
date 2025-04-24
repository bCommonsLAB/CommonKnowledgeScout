import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { env } from 'process';

export async function POST(request: NextRequest) {
  try {
    console.log('[process-text] API-Route aufgerufen');
    
    // Authentifizierung prüfen
    const { userId } = getAuth(request);
    if (!userId) {
      console.error('[process-text] Nicht authentifiziert');
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    console.log('[process-text] Authentifiziert als:', userId);

    // Alle Request-Header protokollieren
    const headerObj: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headerObj[key] = value;
    });
    
    // FormData aus dem Request holen
    const formData = await request.formData();
    const formDataKeys: string[] = [];
    formData.forEach((value, key) => {
      formDataKeys.push(key);
    });
    console.log('[process-text] FormData erhalten mit Feldern:', formDataKeys);

    // JSON-Objekt für die Anfrage erstellen
    const requestData: {
      text: string;
      target_language: string;
      useCache: boolean;
      template: string;
      source_language?: string;
    } = {
      text: formData.get('text') as string,
      target_language: formData.get('targetLanguage') as string,
      useCache: false,
      template: formData.get('template') as string
    };

    if (formData.has('sourceLanguage')) {
      requestData.source_language = formData.get('sourceLanguage') as string;
    }
    const secretaryServiceUrl = env.SECRETARY_SERVICE_URL;
    // Anfrage an den Secretary Service senden
    const response = await fetch(`${secretaryServiceUrl}/transformer/template`, {
      method: 'POST',
      body: JSON.stringify(requestData),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
    });

    console.log('[process-text] Secretary Service Antwort:', {
      status: response.status,
      statusText: response.statusText
    });

    const data = await response.json();
    console.log('[process-text] Antwortdaten:', JSON.stringify(data).substring(0, 100) + '...');

    if (!response.ok) {
      console.error('[process-text] Secretary Service Fehler:', data);
      return NextResponse.json(
        { error: data.error || 'Fehler beim Transformieren der text-Datei' },
        { status: response.status }
      );
    }

    return NextResponse.json(data.data);
  } catch (error) {
    console.error('[process-text] Secretary Service Error:', error);
    return NextResponse.json(
      { error: 'Fehler bei der Verbindung zum Secretary Service' },
      { status: 500 }
    );
  }
} 