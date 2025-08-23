import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { env } from 'process';

export async function POST(request: NextRequest) {
  try {
    console.log('[process-video] API-Route aufgerufen');
    
    // Authentifizierung prüfen
    const { userId } = getAuth(request);
    if (!userId) {
      console.error('[process-video] Nicht authentifiziert');
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    console.log('[process-video] Authentifiziert als:', userId);

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
    console.log('[process-video] FormData erhalten mit Feldern:', formDataKeys);
    

    // Secretary Service URL aus Umgebungsvariablen holen
    const secretaryServiceUrl = env.SECRETARY_SERVICE_URL;
    
    // Sicherstellen, dass keine doppelten Slashes entstehen
    const normalizedUrl = secretaryServiceUrl?.endsWith('/') 
      ? `${secretaryServiceUrl}video/process` 
      : `${secretaryServiceUrl}/video/process`;
    
    console.log('[process-video] Sende Anfrage an Secretary Service:', normalizedUrl);
    
    // Eine neue FormData erstellen, die nur die für den Secretary Service relevanten Felder enthält
    const serviceFormData = new FormData();
    
    // Datei hinzufügen
    if (formData.has('file')) {
      serviceFormData.append('file', formData.get('file') as File);
      
      // Protokolliere ungefähre Dateigröße für Debugging
      const file = formData.get('file') as File;
      console.log('[process-video] Ungefähre Dateigröße:', file.size, 'Bytes');
    }
    
    // Zielsprache (target_language)
    if (formData.has('targetLanguage')) {
      serviceFormData.append('target_language', formData.get('targetLanguage') as string);
    } else {
      serviceFormData.append('target_language', 'de'); // Standardwert
    }
    
    // Quellsprache (source_language)
    if (formData.has('sourceLanguage')) {
      serviceFormData.append('source_language', formData.get('sourceLanguage') as string);
    } else {
      serviceFormData.append('source_language', 'auto'); // Standardwert
    }
    
    // Template-Option
    if (formData.has('template')) {
      serviceFormData.append('template', formData.get('template') as string);
    }
    
    // Cache-Optionen - korrigiert für neue API
    if (formData.has('useCache')) {
      serviceFormData.append('useCache', formData.get('useCache') as string);
    } else {
      serviceFormData.append('useCache', 'true'); // Standardwert: Cache verwenden
    }
    
    // Force refresh Option
    if (formData.has('force_refresh')) {
      serviceFormData.append('force_refresh', formData.get('force_refresh') as string);
    } else {
      serviceFormData.append('force_refresh', 'false'); // Standardwert
    }

    // Anfrage an den Secretary Service senden
    const response = await fetch(normalizedUrl, {
      method: 'POST',
      body: serviceFormData,
      headers: (() => {
        const h: Record<string, string> = { 'Accept': 'application/json' };
        const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
        if (apiKey) { h['Authorization'] = `Bearer ${apiKey}`; h['X-Service-Token'] = apiKey; }
        return h;
      })(),
    });

    console.log('[process-video] Secretary Service Antwort:', {
      status: response.status,
      statusText: response.statusText
    });

    const data = await response.json();
    console.log('[process-video] Antwortdaten:', JSON.stringify(data).substring(0, 100) + '...');

    if (!response.ok) {
      console.error('[process-video] Secretary Service Fehler:', data);
      return NextResponse.json(
        { error: data.error || 'Fehler beim Transformieren der Video-Datei' },
        { status: response.status }
      );
    }

    // Gebe die vollständige Response zurück, nicht nur data.data
    return NextResponse.json(data);
  } catch (error) {
    console.error('[process-video] Secretary Service Error:', error);
    return NextResponse.json(
      { error: 'Fehler bei der Verbindung zum Secretary Service' },
      { status: 500 }
    );
  }
} 