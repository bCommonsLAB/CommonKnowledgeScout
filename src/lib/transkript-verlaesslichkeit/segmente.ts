/**
 * @fileoverview Satz-Segmente mit Verlaesslichkeitswerten aus der Secretary-Antwort lesen.
 *
 * @description
 * Der Secretary liefert je Satz bzw. Abschnitt Zeitmarken und Rohwerte des
 * Modells (Vertrag: Secretary-Hand-off „Verlaesslichkeit je Abschnitt",
 * 09.10.2026). KS speichert sie, um unsichere Stellen im Transkript zu
 * markieren. Diese Funktion ist rein: sie normalisiert die Felder
 * (snake_case → camelCase) und setzt fehlende Werte auf `null` — `null` heisst
 * „nicht geliefert", nie „sicher". Schwellen wendet sie nicht an.
 *
 * @module transkript-verlaesslichkeit
 */

export interface TranscriptSegment {
  /** Sekunden ab Dateibeginn. */
  start: number
  end: number
  /** Text des Modells in Originalsprache (kann vom Transkript-Text abweichen, wenn uebersetzt wurde). */
  text: string
  speaker: string | null
  avgLogprob: number | null
  /** Schlechtestes Wort des Segments — der brauchbarste Marker bei gpt-transcribe. */
  minLogprob: number | null
  compressionRatio: number | null
  noSpeechProb: number | null
  /** `whisper`, `logprobs`, `none` — woher die Werte stammen; null = alter Secretary ohne Angabe. */
  qualitySource: string | null
  /** Vom Modell fuer das Stueck gemeldete Sprache (nur wenn eindeutig). */
  language: string | null
  /** Alle vom Modell gemeldeten Sprachen des Stuecks. */
  languages: string[]
  /** Aus dem Segmenttext erkannte Sprache (zweite Meinung); null bei kurzem Text. */
  textLanguage: string | null
  textLanguageProb: number | null
  /** `estimated`, wenn die Zeiten aus der Textposition geschaetzt sind. */
  timeSource: string | null
}

export interface TranscriptSegmentsResult {
  segments: TranscriptSegment[]
  /** Sprache der ganzen Datei (Mehrheit), wie der Secretary sie meldet. */
  dataLanguage: string | null
  llmModel: string | null
  /** Segmente, die mangels Text oder Zeitmarken verworfen wurden — der Aufrufer protokolliert sie. */
  verworfen: number
}

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => v.trim()) : []
}

/** Segmente liegen flach unter `data.segments` oder verschachtelt unter `data.transcription.segments`. */
function rohSegmente(data: Record<string, unknown>): unknown[] {
  if (Array.isArray(data.segments)) return data.segments
  const nested = obj(data.transcription)?.segments
  return Array.isArray(nested) ? nested : []
}

export function readTranscriptSegments(callbackBody: unknown): TranscriptSegmentsResult {
  const data = obj(obj(callbackBody)?.data)
  if (!data) return { segments: [], dataLanguage: null, llmModel: null, verworfen: 0 }
  const roh = rohSegmente(data)
  const segments: TranscriptSegment[] = []
  for (const eintrag of roh) {
    const s = obj(eintrag)
    const text = str(s?.text)
    const start = num(s?.start)
    const end = num(s?.end)
    if (!s || !text || start === null || end === null) continue
    segments.push({
      start, end, text,
      speaker: str(s.speaker),
      avgLogprob: num(s.avg_logprob),
      minLogprob: num(s.min_logprob),
      compressionRatio: num(s.compression_ratio),
      noSpeechProb: num(s.no_speech_prob),
      qualitySource: str(s.quality_source),
      language: str(s.language),
      languages: strList(s.languages),
      textLanguage: str(s.text_language),
      textLanguageProb: num(s.text_language_prob),
      timeSource: str(s.time_source),
    })
  }
  return { segments, dataLanguage: str(data.language), llmModel: str(data.llm_model), verworfen: roh.length - segments.length }
}
