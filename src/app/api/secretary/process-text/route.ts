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
    const formDataValues: Record<string, string> = {};
    formData.forEach((value, key) => {
      formDataKeys.push(key);
      formDataValues[key] = typeof value === 'string' ? value.substring(0, 100) : String(value);
    });
    console.log('[process-text] FormData erhalten mit Feldern:', formDataKeys);
    console.log('[process-text] FormData Werte:', formDataValues);

    // Text-Parameter validieren
    const text = formData.get('text') as string;
    if (!text || text.trim().length === 0) {
      console.error('[process-text] Kein Text-Parameter gefunden oder Text ist leer');
      return NextResponse.json(
        { error: 'Text-Parameter fehlt oder ist leer' },
        { status: 400 }
      );
    }

    const targetLanguage = formData.get('targetLanguage') as string || 'de';
    const template = formData.get('template') as string || 'Besprechung';
    const sourceLanguage = formData.get('sourceLanguage') as string;

    console.log('[process-text] Request-Daten für Secretary Service:', {
      textLength: text.length,
      target_language: targetLanguage,
      template: template,
      source_language: sourceLanguage || 'nicht angegeben'
    });

    const secretaryServiceUrl = env.SECRETARY_SERVICE_URL;
    
    // FormData für Secretary Service erstellen
    const secretaryFormData = new FormData();
    secretaryFormData.append('text', text);
    secretaryFormData.append('target_language', targetLanguage);
    secretaryFormData.append('template', template);
    secretaryFormData.append('use_cache', 'false');
    
    if (sourceLanguage) {
      secretaryFormData.append('source_language', sourceLanguage);
    }
    
    // Anfrage an den Secretary Service senden
    const response = await fetch(`${secretaryServiceUrl}/transformer/template`, {
      method: 'POST',
      body: secretaryFormData,
      headers: {
        'Accept': 'application/json'
        // Content-Type wird automatisch gesetzt für FormData
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