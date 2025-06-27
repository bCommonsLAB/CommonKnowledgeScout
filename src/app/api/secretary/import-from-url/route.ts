import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/secretary/import-from-url
 * Proxy-Endpunkt zum Secretary Service für Session-Import aus URLs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, source_language, target_language, template, use_cache } = body;
    
    // Validierung der Eingabedaten
    if (!url) {
      return NextResponse.json(
        { 
          status: 'error', 
          error: { 
            code: 'MISSING_URL', 
            message: 'URL ist erforderlich' 
          } 
        },
        { status: 400 }
      );
    }
    
    // URL-Format validieren
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { 
          status: 'error', 
          error: { 
            code: 'INVALID_URL', 
            message: 'Ungültiges URL-Format' 
          } 
        },
        { status: 400 }
      );
    }
    
    // Secretary Service URL aus Umgebungsvariablen
    const secretaryServiceUrl = process.env.SECRETARY_SERVICE_URL || 'http://127.0.0.1:5001';
    const apiUrl = `${secretaryServiceUrl}/transformer/template`;
    
    console.log('[api/secretary/import-from-url] Weiterleitung an Secretary Service:', apiUrl);
    console.log('[api/secretary/import-from-url] Parameter:', { url, source_language, target_language, template, use_cache });
    
    // Form-Data für den Secretary Service erstellen
    const formData = new URLSearchParams();
    formData.append('url', url);
    formData.append('source_language', source_language || 'en');
    formData.append('target_language', target_language || 'en');
    formData.append('template', template || 'ExtractSessiondataFromWebsite');
    formData.append('use_cache', String(use_cache || false));
    
    // Anfrage an Secretary Service weiterleiten
    const secretaryResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });
    
    console.log('[api/secretary/import-from-url] Secretary Service Antwort:', secretaryResponse.status);
    
    const secretaryData = await secretaryResponse.json();
    
    if (!secretaryResponse.ok) {
      console.error('[api/secretary/import-from-url] Secretary Service Fehler:', secretaryData);
      return NextResponse.json(
        { 
          status: 'error', 
          error: { 
            code: 'SECRETARY_SERVICE_ERROR', 
            message: secretaryData.error || 'Fehler beim Secretary Service' 
          } 
        },
        { status: secretaryResponse.status }
      );
    }
    
    // Erfolgreiche Antwort vom Secretary Service
    console.log('[api/secretary/import-from-url] Session-Daten erfolgreich extrahiert');
    
    // Antwort-Format für den Client anpassen
    const responseData = {
      status: 'success',
      data: secretaryData.data || secretaryData,
      metadata: {
        url,
        extracted_at: new Date().toISOString(),
        template_used: template || 'ExtractSessiondataFromWebsite'
      }
    };
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('[api/secretary/import-from-url] Fehler:', error);
    
    return NextResponse.json(
      { 
        status: 'error', 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Interner Server-Fehler beim Session-Import' 
        } 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/secretary/import-from-url
 * Gibt Informationen über den Import-Endpunkt zurück
 */
export async function GET() {
  return NextResponse.json({
    status: 'info',
    message: 'Session Import API',
    description: 'Extrahiert Session-Daten aus Websites mithilfe des Secretary Services',
    supported_methods: ['POST'],
    parameters: {
      url: 'string (required) - URL der Website',
      source_language: 'string (optional) - Quellsprache (Standard: en)',
      target_language: 'string (optional) - Zielsprache (Standard: en)',
      template: 'string (optional) - Template-Name (Standard: ExtractSessiondataFromWebsite)',
      use_cache: 'boolean (optional) - Cache verwenden (Standard: false)'
    }
  });
} 