/**
 * Extrahiert den bestmöglichen Volltext aus einer Secretary-Audio-Response.
 *
 * Hintergrund:
 * Der Service liefert je nach Pipeline/Version unterschiedliche Felder.
 * Für Diktat ist ein vollständiger Text wichtiger als ein evtl. partieller Zwischenwert.
 *
 * P3a (Sprecher-Erkennung, `audio/process-diarized`): Tragen die Segmente ein
 * `speaker`, entsteht der Text deterministisch HIER aus den Segmenten — ein
 * Präfix je Absatz, aufeinanderfolgende Segmente desselben Sprechers
 * zusammengefasst (Plan audio-namensraum-und-diarisierung, „Darstellung im
 * Markdown"). Zeitmarken bleiben draußen. Die Sprecherliste geht flach ins
 * Frontmatter (`speakers`), nie die Segmente (Frontmatter-Regel: flach).
 */

export interface SpeakerSegment {
  /** Sprecher-Label des Anbieters, z. B. „Sprecher A"; leer = ohne Zuordnung. */
  speaker: string
  text: string
}

export interface SecretaryAudioTranscript {
  text: string
  /** Sprecher in Reihenfolge des ersten Auftretens; leer ohne Sprecher-Erkennung. */
  speakers: string[]
}

export function extractSecretaryAudioText(response: unknown): string {
  return extractSecretaryAudioTranscript(response).text
}

/**
 * Text UND Sprecherliste. Reihenfolge bewusst explizit:
 * 0) Segmente mit Sprecher: Absätze mit Präfix (eigene Darstellung, s. o.)
 * 1) output_text: finaler/aggregierter Output der Pipeline
 * 2) translated_text: falls explizite Übersetzung vorhanden
 * 3) original_text: voll aggregiertes Original
 * 4) transcription.text: ältere/alternative Antwortformate
 * 5) segments: letzter Fallback, falls nur Segmentliste vorliegt
 */
export function extractSecretaryAudioTranscript(response: unknown): SecretaryAudioTranscript {
  const dataNode = getObject(getObject(response)?.data)
  if (!dataNode) return { text: '', speakers: [] }

  const segments = readSpeakerSegments(dataNode)
  if (segments.length > 0) {
    return {
      text: buildSpeakerParagraphs(segments),
      speakers: readSpeakerList(dataNode.speakers, segments),
    }
  }

  const outputText = getString(dataNode.output_text)
  const translatedText = getString(dataNode.translated_text)
  const originalText = getString(dataNode.original_text)
  const transcriptionText = getString(getObject(dataNode.transcription)?.text)
  const segmentsText = joinSegmentTexts(readSegments(dataNode))

  return {
    text: outputText || translatedText || originalText || transcriptionText || segmentsText || '',
    speakers: [],
  }
}

/**
 * Segmente mit Sprecher-Label, oder leer, wenn KEIN Segment eines trägt.
 * Tragen nur manche ein Label, bleiben die anderen ohne Präfix sichtbar —
 * der Text geht nicht verloren, die Lücke ist im Transkript erkennbar.
 */
export function readSpeakerSegments(dataNode: Record<string, unknown>): SpeakerSegment[] {
  const raw = readSegments(dataNode)
  const segments = raw
    .map((segment) => {
      const node = getObject(segment)
      return { speaker: getString(node?.speaker), text: getString(node?.text) }
    })
    .filter((segment) => segment.text.length > 0)
  return segments.some((segment) => segment.speaker.length > 0) ? segments : []
}

/** Ein Absatz je Sprecherwechsel: `**Sprecher A:** Text`; ohne Label nur der Text. */
export function buildSpeakerParagraphs(segments: SpeakerSegment[]): string {
  const paragraphs: Array<{ speaker: string; parts: string[] }> = []
  for (const segment of segments) {
    const last = paragraphs[paragraphs.length - 1]
    if (last && last.speaker === segment.speaker) {
      last.parts.push(segment.text)
    } else {
      paragraphs.push({ speaker: segment.speaker, parts: [segment.text] })
    }
  }
  return paragraphs
    .map((paragraph) => {
      const text = paragraph.parts.join(' ')
      return paragraph.speaker ? `**${paragraph.speaker}:** ${text}` : text
    })
    .join('\n\n')
}

function readSpeakerList(explicit: unknown, segments: SpeakerSegment[]): string[] {
  if (Array.isArray(explicit)) {
    const list = explicit.map(getString).filter((entry) => entry.length > 0)
    if (list.length > 0) return list
  }
  const seen = new Set<string>()
  for (const segment of segments) {
    if (segment.speaker) seen.add(segment.speaker)
  }
  return Array.from(seen)
}

/** Segmente liegen je Antwortform unter `data.segments` oder `data.transcription.segments`. */
function readSegments(dataNode: Record<string, unknown>): unknown[] {
  if (Array.isArray(dataNode.segments)) return dataNode.segments
  const nested = getObject(dataNode.transcription)?.segments
  return Array.isArray(nested) ? nested : []
}

function getObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function joinSegmentTexts(value: unknown[]): string {
  const parts = value
    .map((segment) => getString(getObject(segment)?.text))
    .filter((text) => text.length > 0)
  return parts.join(' ').trim()
}
