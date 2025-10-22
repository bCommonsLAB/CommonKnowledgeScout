import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
// env ungenutzt
import { getSecretaryConfig } from '@/lib/env'

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
    const text = (formData.get('text') as string) || '';
    if (!text || text.trim().length === 0) {
      console.error('[process-text] Kein Text-Parameter gefunden oder Text ist leer');
      return NextResponse.json(
        { error: 'Text-Parameter fehlt oder ist leer' },
        { status: 400 }
      );
    }

    // Sprachen
    const targetLanguage = (formData.get('target_language') as string) || (formData.get('targetLanguage') as string) || 'de';
    const sourceLanguage = (formData.get('source_language') as string) || (formData.get('sourceLanguage') as string) || '';

    // Template-Name und Content (beide optional, aber mindestens eins MUSS vorhanden sein)
    const templateName = ((formData.get('template') as string) || '').trim();
    const templateContent = ((formData.get('template_content') as string) || (formData.get('templateContent') as string) || '').trim();

    if (!templateName && !templateContent) {
      console.error('[process-text] Weder template noch template_content übergeben');
      return NextResponse.json(
        { error: 'Erforderlich: Entweder template (Name) ODER template_content (String) übergeben' },
        { status: 400 }
      );
    }

    const isTemplateContent = templateContent.length > 0;

    console.log('[process-text] Request-Daten für Secretary Service:', {
      textLength: text.length,
      target_language: targetLanguage,
      template: isTemplateContent ? 'CUSTOM_CONTENT' : templateName,
      templateContentLength: isTemplateContent ? templateContent.length : 0,
      source_language: sourceLanguage || 'nicht angegeben'
    });

    const { baseUrl: secretaryServiceUrl } = getSecretaryConfig();
    
    // FormData für Secretary Service erstellen
    const secretaryFormData = new FormData();
    secretaryFormData.append('text', text);
    secretaryFormData.append('target_language', targetLanguage);
    
    // Template-Parameter: entweder Name oder Content
    if (isTemplateContent) {
      secretaryFormData.append('template_content', templateContent);
    } else {
      secretaryFormData.append('template', templateName);
    }
    
    secretaryFormData.append('use_cache', 'false');
    
    if (sourceLanguage) {
      secretaryFormData.append('source_language', sourceLanguage);
    }
    
    // Trace: Eingehende Client-Parameter in Job-Trace gibt es hier nicht (kein jobId). Wir loggen Server-seitig minimal per Console und Response-Felder
    // Anfrage an den Secretary Service senden
    const response = await fetch(`${secretaryServiceUrl}/transformer/template`, {
      method: 'POST',
      body: secretaryFormData,
      headers: (() => {
        const h: Record<string, string> = { 'Accept': 'application/json' };
        const { apiKey } = getSecretaryConfig();
        if (apiKey) { h['Authorization'] = `Bearer ${apiKey}`; h['X-Service-Token'] = apiKey; }
        return h;
      })(),
    });

    console.log('[process-text] Secretary Service Antwort:', {
      status: response.status,
      statusText: response.statusText
    });

    const data = await response.json();
    console.log('[process-text] secretary_request_ack+', { status: response.status, hasData: !!data, keys: data && typeof data === 'object' ? Object.keys(data) : [] });
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