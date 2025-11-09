/**
 * @fileoverview Session Processor - Session Data Processing Utilities
 * 
 * @description
 * Utilities for processing session data for event jobs. Converts VTT transcripts to
 * plain text, extracts video transcripts from Vimeo, and builds session payloads for
 * Secretary Service processing. Handles client-side and server-side transcript extraction.
 * 
 * @module event-job
 * 
 * @exports
 * - vttToPlainText: Converts VTT format to plain text
 * - extractVideoTranscript: Extracts video transcript from Vimeo URL
 * - buildSessionPayload: Builds session processing payload from job parameters
 * 
 * @usedIn
 * - src/app/api/event-job: Event job API routes use processor
 * - src/components/event-monitor: Event monitor components use processor
 * 
 * @dependencies
 * - @/lib/secretary/client: ProcessSessionInput type
 * - @/types/event-job: Job and JobParameters types
 */

import type { ProcessSessionInput } from '@/lib/secretary/client';
import type { JobParameters, Job } from '@/types/event-job';

/**
 * Konvertiert VTT-Text in Plaintext
 * Entfernt Header, Nummern, Zeitcodes und formatiert den Text
 */
export function vttToPlainText(vtt: string): string {
  return vtt
    .replace(/^WEBVTT.*$/gmi, '')
    .replace(/^\d+\s*$/gmi, '')
    .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}.*$/gmi, '')
    .replace(/^-+$/gmi, '')
    .replace(/\r/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrahiert Video-Transcript aus einer Video-URL
 * Unterstützt Vimeo-Videos über die Video-API
 * 
 * WICHTIG: Diese Funktion funktioniert nur clientseitig, da die API-Route Authentifizierung benötigt.
 * Für Server-Side-Verwendung sollte das Transcript bereits clientseitig extrahiert und übergeben werden.
 * 
 * @param videoUrl URL des Videos (Vimeo URL oder player URL)
 * @returns Plaintext-Transcript oder null wenn nicht verfügbar
 */
export async function extractVideoTranscript(
  videoUrl: string | null | undefined
): Promise<string | null> {
  if (!videoUrl) {
    return null;
  }

  // Sicherstellen, dass wir clientseitig sind
  if (typeof window === 'undefined') {
    console.warn('[extractVideoTranscript] Wird server-seitig aufgerufen - sollte clientseitig sein');
    return null;
  }

  try {
    // Vimeo Video-ID extrahieren
    const idMatch = String(videoUrl).match(/(?:player\.vimeo\.com\/video\/|vimeo\.com\/)(\d+)/);
    const body: { videoId: string } | { playerUrl: string } = idMatch 
      ? { videoId: idMatch[1] } 
      : { playerUrl: videoUrl };

    // Transcript von API abrufen (clientseitig)
    const response = await fetch('/api/video/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return null;
    }

    const data: { 
      status?: string; 
      data?: { 
        vtt?: string; 
        track?: { 
          id?: string; 
          language?: string; 
          kind?: string; 
          name?: string; 
          link?: string;
        };
      };
    } = await response.json();

    if (data?.status === 'success' && data?.data?.vtt) {
      const plainText = vttToPlainText(String(data.data.vtt));
      return plainText;
    }

    return null;
  } catch (error) {
    console.error('[extractVideoTranscript] Fehler beim Extrahieren:', error);
    return null;
  }
}

/**
 * Erstellt einen Session-Process-Payload aus Job-Parametern
 * Extrahiert automatisch Video-Transcript falls video_url vorhanden ist (nur clientseitig)
 * 
 * @param parameters Job-Parameter
 * @param job Job-Objekt (optional, für Fallback-Werte)
 * @param videoTranscript Optional: Bereits extrahiertes Video-Transcript (für Server-Side-Verwendung)
 * @returns ProcessSessionInput mit optionalem video_transcript
 */
export async function buildSessionPayload(
  parameters: JobParameters,
  job?: Job,
  videoTranscript?: string | null
): Promise<ProcessSessionInput> {
  // Basis-Payload erstellen
  const payload: ProcessSessionInput = {
    event: parameters.event || '',
    session: parameters.session || (job?.job_name || job?.job_id || ''),
    url: parameters.url || '',
    filename: parameters.filename || (parameters.session ? `${parameters.session}.md` : (job?.job_id || '') + '.md'),
    track: parameters.track || (parameters.event ? `${parameters.event}-track` : 'track'),
    day: parameters.day,
    starttime: parameters.starttime,
    endtime: parameters.endtime,
    speakers: Array.isArray(parameters.speakers) ? parameters.speakers : undefined,
    speakers_url: Array.isArray(parameters.speakers_url) ? parameters.speakers_url : undefined,
    speakers_image_url: Array.isArray(parameters.speakers_image_url) ? parameters.speakers_image_url : undefined,
    video_url: parameters.video_url,
    attachments_url: parameters.attachments_url,
    source_language: parameters.source_language || 'en',
    target_language: parameters.target_language || 'de',
    template: parameters.template || 'Session_analyze',
    use_cache: parameters.use_cache ?? false,
    create_archive: true,
  };

  // Video-Transcript hinzufügen
  // Priorität: 1) Bereits extrahiertes Transcript 2) Client-seitige Extraktion
  if (videoTranscript) {
    // Bereits extrahiertes Transcript verwenden (z.B. vom Client mitgesendet)
    payload.video_transcript = videoTranscript;
  } else if (parameters.video_url && typeof window !== 'undefined') {
    // Nur clientseitig: Transcript extrahieren (server-seitig nicht möglich wegen Auth)
    const transcriptText = await extractVideoTranscript(parameters.video_url);
    if (transcriptText) {
      payload.video_transcript = transcriptText;
    }
  }

  return payload;
}

