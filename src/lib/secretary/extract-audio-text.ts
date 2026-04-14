/**
 * Extrahiert den bestmöglichen Volltext aus einer Secretary-Audio-Response.
 *
 * Hintergrund:
 * Der Service liefert je nach Pipeline/Version unterschiedliche Felder.
 * Für Diktat ist ein vollständiger Text wichtiger als ein evtl. partieller Zwischenwert.
 */
export function extractSecretaryAudioText(response: unknown): string {
  const dataNode = getObject(getObject(response)?.data)
  if (!dataNode) return ''

  const outputText = getString(dataNode.output_text)
  const translatedText = getString(dataNode.translated_text)
  const originalText = getString(dataNode.original_text)
  const transcriptionText = getString(getObject(dataNode.transcription)?.text)
  const segmentsText = joinSegmentTexts(dataNode.segments)

  // Reihenfolge bewusst explizit:
  // 1) output_text: finaler/aggregierter Output der Pipeline
  // 2) translated_text: falls explizite Übersetzung vorhanden
  // 3) original_text: voll aggregiertes Original
  // 4) transcription.text: ältere/alternative Antwortformate
  // 5) segments: letzter Fallback, falls nur Segmentliste vorliegt
  return outputText || translatedText || originalText || transcriptionText || segmentsText || ''
}

function getObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function joinSegmentTexts(value: unknown): string {
  if (!Array.isArray(value)) return ''
  const parts = value
    .map((segment) => getString(getObject(segment)?.text))
    .filter((text) => text.length > 0)
  return parts.join(' ').trim()
}
