export class SecretaryServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretaryServiceError';
  }
}

/**
 * Transformiert eine Audio-Datei mithilfe des Secretary Services in Text
 * 
 * @param file Die zu transformierende Audio-Datei 
 * @param targetLanguage Die Zielsprache für die Transkription
 * @param libraryId ID der aktiven Bibliothek
 * @returns Den transformierten Text
 */
export async function transformAudio(
  file: File, 
  targetLanguage: string,
  libraryId: string
): Promise<string> {
  try {
    console.log('[secretary/client] transformAudio aufgerufen mit Sprache:', targetLanguage);
    
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-audio', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Daten erfolgreich empfangen');
    return data.transcription.text;
  } catch (error) {
    console.error('[secretary/client] Fehler:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der Audio-Datei');
  }
}

/**
 * Transformiert einen Text mithilfe des Secretary Services
 * 
 * @param textContent Der zu transformierende Text
 * @param targetLanguage Die Zielsprache für die Transformation
 * @param libraryId ID der aktiven Bibliothek
 * @param template Optionales Template für die Transformation (Standard: "Besprechung")
 * @returns Den transformierten Text
 */
export async function transformText(
  textContent: string,
  targetLanguage: string,
  libraryId: string,
  template: string = "Besprechung"
): Promise<string> {
  try {
    console.log('[secretary/client] transformText aufgerufen mit Sprache:', targetLanguage, 'und Template:', template);
    console.log('[secretary/client] Text-Länge:', textContent?.length || 0);
    console.log('[secretary/client] Text-Vorschau:', textContent?.substring(0, 100) || 'KEIN TEXT');
    
    if (!textContent || textContent.trim().length === 0) {
      throw new SecretaryServiceError('Kein Text zum Transformieren vorhanden');
    }
    
    const formData = new FormData();
    formData.append('text', textContent);
    formData.append('targetLanguage', targetLanguage);
    formData.append('template', template);
    
    // Debug: FormData-Inhalt prüfen
    console.log('[secretary/client] FormData erstellt mit:', {
      text: formData.get('text') ? 'vorhanden' : 'fehlt',
      targetLanguage: formData.get('targetLanguage'),
      template: formData.get('template')
    });
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-text', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Daten erfolgreich empfangen');
    return data.text;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Texttransformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung des Textes');
  }
}

/**
 * Erstellt eine Zusammenfassung für einen einzelnen Track
 * 
 * @param trackName Name des Tracks
 * @param targetLanguage Zielsprache für die Zusammenfassung
 * @param libraryId ID der aktiven Bibliothek
 * @param template Template für die Zusammenfassung (Standard: "track_eco_social")
 * @param useCache Cache verwenden (Standard: false)
 * @returns Die API-Antwort mit der Zusammenfassung
 */
export async function createTrackSummary(
  trackName: string,
  targetLanguage: string,
  libraryId: string,
  template: string = "track_eco_social",
  useCache: boolean = false
): Promise<unknown> {
  try {
    console.log('[secretary/client] createTrackSummary aufgerufen für Track:', trackName, 'und Bibliothek:', libraryId);
    console.log('[secretary/client] Template:', template, 'Sprache:', targetLanguage);
    
    if (!trackName) {
      throw new SecretaryServiceError('Kein Track-Name angegeben');
    }
    
    if (!libraryId) {
      console.warn('[secretary/client] WARNUNG: Keine Bibliotheks-ID angegeben!');
    }
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Library-Id': libraryId
    };
    
    const requestBody = {
      template,
      target_language: targetLanguage,
      useCache
    };
    
    console.log('[secretary/client] Sende Anfrage an Secretary Track Processor API:', JSON.stringify(requestBody));
    const response = await fetch(`/api/secretary/tracks/${encodeURIComponent(trackName)}/summary`, {
      method: 'POST',
      headers: customHeaders,
      body: JSON.stringify(requestBody)
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('[secretary/client] Antwort-Daten:', JSON.stringify(data).substring(0, 500) + '...');
    
    if (!response.ok) {
      // Detaillierte Fehlermeldung konstruieren
      let errorMsg = `Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`;
      if (data && data.error) {
        errorMsg += ` - ${data.error.code || ''}: ${data.error.message || 'Unbekannter Fehler'}`;
      }
      throw new SecretaryServiceError(errorMsg);
    }

    console.log('[secretary/client] Zusammenfassung erfolgreich erstellt');
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Erstellung der Track-Zusammenfassung:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Erstellung der Track-Zusammenfassung');
  }
}

/**
 * Erstellt Zusammenfassungen für alle oder gefilterte Tracks
 * 
 * @param targetLanguage Zielsprache für die Zusammenfassungen
 * @param libraryId ID der aktiven Bibliothek
 * @param template Template für die Zusammenfassungen (Standard: "track_eco_social") 
 * @param useCache Cache verwenden (Standard: false)
 * @returns Die API-Antwort mit allen Zusammenfassungen
 */
export async function createAllTrackSummaries(
  targetLanguage: string,
  libraryId: string,
  template: string = "track_eco_social",
  useCache: boolean = false
): Promise<unknown> {
  try {
    console.log('[secretary/client] createAllTrackSummaries aufgerufen');
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Library-Id': libraryId
    };
    
    console.log('[secretary/client] Sende Anfrage an Secretary Track Processor API');
    const response = await fetch('/api/secretary/tracks/*/summarize_all', {
      method: 'POST',
      headers: customHeaders,
      body: JSON.stringify({
        template,
        target_language: targetLanguage,
        useCache
      })
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Alle Zusammenfassungen erfolgreich erstellt');
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Erstellung aller Track-Zusammenfassungen:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Erstellung aller Track-Zusammenfassungen');
  }
}

/**
 * Transformiert eine Video-Datei mithilfe des Secretary Services
 * 
 * @param file Die zu transformierende Video-Datei 
 * @param options Optionen für die Video-Transformation
 * @param libraryId ID der aktiven Bibliothek
 * @returns Die Transformationsergebnisse
 */
export async function transformVideo(
  file: File, 
  options: {
    extractAudio?: boolean;
    extractFrames?: boolean;
    frameInterval?: number;
    targetLanguage?: string;
    sourceLanguage?: string;
    template?: string;
  },
  libraryId: string
): Promise<{
  transcription?: { text: string };
  frames?: { url: string; timestamp: number }[];
}> {
  try {
    console.log('[secretary/client] transformVideo aufgerufen mit Optionen:', options);
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Sprachoptionen
    if (options.targetLanguage) {
      formData.append('targetLanguage', options.targetLanguage);
    }
    
    if (options.sourceLanguage) {
      formData.append('sourceLanguage', options.sourceLanguage);
    }
    
    // Template-Option
    if (options.template) {
      formData.append('template', options.template);
    }
    
    // Video-spezifische Optionen
    if (options.extractAudio !== undefined) {
      formData.append('extractAudio', options.extractAudio.toString());
    }
    
    if (options.extractFrames !== undefined) {
      formData.append('extractFrames', options.extractFrames.toString());
    }
    
    if (options.frameInterval !== undefined) {
      formData.append('frameInterval', options.frameInterval.toString());
    }
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-video', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Video-Daten erfolgreich empfangen');
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Video-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der Video-Datei');
  }
} 