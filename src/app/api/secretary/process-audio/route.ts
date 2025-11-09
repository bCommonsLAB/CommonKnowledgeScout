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
import { env } from 'process';

export async function POST(request: NextRequest) {
  try {
    console.log('[process-audio] API-Route aufgerufen');
    
    // Authentifizierung prüfen
    const { userId } = getAuth(request);
    if (!userId) {
      console.error('[process-audio] Nicht authentifiziert');
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    console.log('[process-audio] Authentifiziert als:', userId);

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
    console.log('[process-audio] FormData erhalten mit Feldern:', formDataKeys);
    

    // Secretary Service URL und API-Key aus den Headers holen
    const secretaryServiceUrl = env.SECRETARY_SERVICE_URL;
    
    console.log('[process-audio] Sende Anfrage an Secretary Service:', secretaryServiceUrl);
    
    // Eine neue FormData erstellen, die nur die für den Secretary Service relevanten Felder enthält
    const serviceFormData = new FormData();
    
    // Datei hinzufügen
    if (formData.has('file')) {
      serviceFormData.append('file', formData.get('file') as File);
    }
    
    // Zielsprache hinzufügen
    if (formData.has('targetLanguage')) {
      serviceFormData.append('target_language', formData.get('targetLanguage') as string);
    }
    serviceFormData.append('useCache', 'false');

    // Anfrage an den Secretary Service senden
    const response = await fetch(`${secretaryServiceUrl}/audio/process`, {
      method: 'POST',
      body: serviceFormData,
      headers: (() => {
        const h: Record<string, string> = { 'Accept': 'application/json' };
        const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
        if (apiKey) { h['Authorization'] = `Bearer ${apiKey}`; h['X-Service-Token'] = apiKey; }
        return h;
      })(),
    });

    console.log('[process-audio] Secretary Service Antwort:', {
      status: response.status,
      statusText: response.statusText
    });

    const data = await response.json();
    console.log('[process-audio] Antwortdaten:', JSON.stringify(data).substring(0, 100) + '...');

    if (!response.ok) {
      console.error('[process-audio] Secretary Service Fehler:', data);
      return NextResponse.json(
        { error: data.error || 'Fehler beim Transformieren der Audio-Datei' },
        { status: response.status }
      );
    }

    // Gebe die vollständige Response zurück, nicht nur data.data
    return NextResponse.json(data);
  } catch (error) {
    console.error('[process-audio] Secretary Service Error:', error);
    return NextResponse.json(
      { error: 'Fehler bei der Verbindung zum Secretary Service' },
      { status: 500 }
    );
  }
} 