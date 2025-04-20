interface TransformationError {
  error: string;
}

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
 * @param options Optionale Konfiguration mit apiUrl und apiKey
 * @returns Den transformierten Text
 */
export async function transformAudio(
  file: File, 
  targetLanguage: string,
  libraryId: string,
  apiUrl: string,
  apiKey: string
): Promise<string> {
  try {
    console.log('[secretary/client] transformAudio aufgerufen mit Sprache:', targetLanguage);
    
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    customHeaders['X-Secretary-Service-Url'] = apiUrl;
    customHeaders['X-Secretary-Service-Api-Key'] = apiKey;
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
 * @param apiUrl URL des Secretary Services
 * @param apiKey API-Key für den Secretary Service
 * @param template Optionales Template für die Transformation (Standard: "Besprechung")
 * @returns Den transformierten Text
 */
export async function transformText(
  textContent: string,
  targetLanguage: string,
  libraryId: string,
  apiUrl: string,
  apiKey: string,
  template: string = "Besprechung"
): Promise<string> {
  try {
    console.log('[secretary/client] transformText aufgerufen mit Sprache:', targetLanguage, 'und Template:', template);
    
    const formData = new FormData();
    formData.append('text', textContent);
    formData.append('targetLanguage', targetLanguage);
    formData.append('template', template);
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    customHeaders['X-Secretary-Service-Url'] = apiUrl;
    customHeaders['X-Secretary-Service-Api-Key'] = apiKey;
    
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