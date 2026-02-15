/**
 * @fileoverview Korpus-Builder für Multi-Source Creation Wizard
 * 
 * @description
 * Baut einen einheitlichen Textkorpus aus mehreren Quellen für LLM-Verarbeitung.
 * Trennt zwischen LLM-Rohtext (Point-of-Truth) und UI-Summaries.
 */

export interface WizardSource {
  id: string
  kind: 'text' | 'url' | 'file'
  /** Datum (Date oder ISO-String aus JSON-Deserialisierung) */
  createdAt: Date | string
  
  // Für 'text':
  text?: string
  
  // Für 'url':
  url?: string
  rawWebsiteText?: string  // Rohtext für LLM (Point-of-Truth)
  
  // Für 'file':
  fileName?: string
  extractedText?: string  // Extrahierter Text für LLM
  
  // Gemeinsam für 'url' und 'file':
  summary?: string        // Lesbare Summary für UI
}

/**
 * Baut den Gesamtkorpus-Text aus allen Quellen für LLM-Verarbeitung.
 * 
 * Format:
 * ```
 * [Quelle: Text | 2025-12-13 10:42]
 * ...Text-Inhalt...
 * 
 * [Quelle: Webseite | https://example.com]
 * ...Rohtext der Webseite...
 * ```
 * 
 * @param sources Liste aller Quellen (chronologisch sortiert)
 * @returns Kombinierter Korpus-Text für LLM
 */
/** Konvertiert createdAt (Date oder ISO-String aus JSON) zu Timestamp. */
function toTimestamp(createdAt: Date | string): number {
  if (createdAt instanceof Date) return createdAt.getTime()
  const t = new Date(createdAt).getTime()
  return Number.isFinite(t) ? t : 0
}

/** Konvertiert createdAt zu ISO-String für Anzeige. */
function toIsoSlice(createdAt: Date | string): string {
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt)
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

export function buildCorpusText(sources: WizardSource[]): string {
  if (sources.length === 0) {
    return ''
  }

  // Sortiere nach createdAt (chronologisch). createdAt kann Date oder ISO-String sein (z.B. aus API-JSON).
  const sorted = [...sources].sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt))

  const blocks: string[] = []

  for (const source of sorted) {
    const dateStr = toIsoSlice(source.createdAt)
    
    let header = ''
    let content = ''
    
    if (source.kind === 'text' && source.text) {
      header = `[Quelle: Text | ${dateStr}]`
      content = source.text.trim()
    } else if (source.kind === 'url') {
      header = `[Quelle: Webseite | ${source.url || 'unbekannt'}]`
      // WICHTIG: Für LLM immer den Rohtext verwenden, nicht die Summary
      content = source.rawWebsiteText?.trim() || ''
      if (!content && source.summary) {
        // Fallback: Wenn kein rawWebsiteText vorhanden, nutze Summary (sollte nicht passieren, aber defensiv)
        content = source.summary.trim()
      }
    } else if (source.kind === 'file') {
      header = `[Quelle: Datei | ${source.fileName || 'unbekannt'}]`
      // WICHTIG: Für LLM immer den extrahierten Text verwenden, nicht die Summary
      content = source.extractedText?.trim() || ''
      if (!content && source.summary) {
        // Fallback: Wenn kein extractedText vorhanden, nutze Summary
        content = source.summary.trim()
      }
    }
    
    if (header && content) {
      blocks.push(`${header}\n${content}`)
    }
  }
  
  return blocks.join('\n\n')
}

/**
 * Baut eine lesbare Summary einer Quelle für die UI.
 * 
 * @param source Die Quelle
 * @returns Lesbare Summary (für Anzeige in Quellenliste)
 */
export function buildSourceSummary(source: WizardSource): string {
  if (source.kind === 'text' && source.text) {
    // Text: Zeige ersten 200 Zeichen
    const preview = source.text.length > 200 
      ? `${source.text.slice(0, 200)}...` 
      : source.text
    return preview
  }
  
  if (source.kind === 'url') {
    // URL: Zeige Summary (strukturierte Daten als Key-Value)
    if (source.summary) {
      return source.summary
    }
    // Fallback: URL selbst
    return source.url || 'Unbekannte URL'
  }
  
  if (source.kind === 'file') {
    // Datei: Zeige Summary oder Dateiname
    if (source.summary) {
      return source.summary
    }
    return source.fileName || 'Unbekannte Datei'
  }
  
  return 'Unbekannte Quelle'
}

/**
 * Validiert, ob ein Korpus-Text die maximale Größe überschreitet.
 * 
 * @param corpusText Der Korpus-Text
 * @param maxChars Maximale Zeichenanzahl (Default: 500000)
 * @returns Ob der Korpus zu groß ist
 */
export function isCorpusTooLarge(corpusText: string, maxChars: number = 500000): boolean {
  return corpusText.length > maxChars
}

/**
 * Kürzt einen Korpus-Text auf die maximale Größe.
 * 
 * @param corpusText Der Korpus-Text
 * @param maxChars Maximale Zeichenanzahl (Default: 500000)
 * @returns Gekürzter Text mit Warnung
 */
export function truncateCorpus(corpusText: string, maxChars: number = 500000): string {
  if (corpusText.length <= maxChars) {
    return corpusText
  }
  
  const truncated = corpusText.slice(0, maxChars)
  const warning = '\n\n[WARNUNG: Korpus wurde gekürzt, um API-Limit einzuhalten]'
  
  return truncated + warning
}




