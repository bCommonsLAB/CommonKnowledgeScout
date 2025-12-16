/**
 * @fileoverview Secretary Audio Processing API Route - Audio Transformation Endpoint
 * 
 * @description
 * API endpoint for processing audio files via Secretary Service. Proxies audio
 * processing requests to Secretary Service with authentication. Handles file uploads,
 * target language configuration, and response forwarding.
 * 
 * @module secretary
 * 
 * @exports
 * - POST: Processes audio file via Secretary Service
 * 
 * @usedIn
 * - Next.js framework: Route handler for /api/secretary/process-audio
 * - src/components/library: Library components call this endpoint
 * 
 * @dependencies
 * - @clerk/nextjs/server: Authentication utilities
 * - process.env: Environment variables for Secretary Service URL and API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { getSecretaryConfig } from '@/lib/env'

export async function POST(request: NextRequest) {
  try {
    // Authentifizierung prüfen
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    // FormData aus dem Request holen
    const formData = await request.formData();

    const { baseUrl: secretaryServiceUrl, apiKey } = getSecretaryConfig();
    if (!secretaryServiceUrl) {
      return NextResponse.json(
        { error: 'SECRETARY_SERVICE_URL ist nicht konfiguriert' },
        { status: 500 }
      );
    }
    
    // Eine neue FormData erstellen, die nur die für den Secretary Service relevanten Felder enthält
    const serviceFormData = new FormData();
    
    // Datei hinzufügen
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Audio-Datei fehlt (Feld "file")' },
        { status: 400 }
      );
    }
    serviceFormData.append('file', file);
    
    // Sprachen (unterstütze sowohl camelCase als auch snake_case von Clients)
    const sourceLanguage =
      (formData.get('source_language') as string | null) ||
      (formData.get('sourceLanguage') as string | null) ||
      undefined
    const targetLanguage =
      (formData.get('target_language') as string | null) ||
      (formData.get('targetLanguage') as string | null) ||
      'de'

    if (sourceLanguage) serviceFormData.append('source_language', sourceLanguage)
    if (targetLanguage) serviceFormData.append('target_language', targetLanguage)

    // Optional: Template (Secretary kann Audio→Text danach noch template-basiert transformieren)
    const template =
      (formData.get('template') as string | null) ||
      undefined
    if (template && template.trim()) serviceFormData.append('template', template.trim())

    // Cache ausschalten (Wizard soll frische Ergebnisse liefern)
    serviceFormData.append('useCache', 'false');

    // Anfrage an den Secretary Service senden
    const response = await fetch(`${secretaryServiceUrl}/audio/process`, {
      method: 'POST',
      body: serviceFormData,
      headers: (() => {
        const h: Record<string, string> = { 'Accept': 'application/json' };
        if (apiKey) { h['Authorization'] = `Bearer ${apiKey}`; h['X-Service-Token'] = apiKey; }
        return h;
      })(),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Fehler beim Transformieren der Audio-Datei' },
        { status: response.status }
      );
    }

    // Gebe die vollständige Response zurück, nicht nur data.data
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Fehler bei der Verbindung zum Secretary Service' },
      { status: 500 }
    );
  }
} 