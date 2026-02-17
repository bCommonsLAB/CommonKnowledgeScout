/**
 * @fileoverview Korpus-Builder für Multi-Source Creation Wizard
 *
 * @description
 * Baut einen einheitlichen Textkorpus aus mehreren Quellen für LLM-Verarbeitung.
 * Trennt zwischen LLM-Rohtext (Point-of-Truth) und UI-Summaries.
 *
 * Shadow-Twin-Metadaten: Bei Datei-Quellen mit sourceMetadata werden diese als
 * "Metadaten aus Shadow-Twin:"-Block in den Kontext geschrieben. Der Secretary
 * nutzt sie für Template-Felder wie attachments_url, attachment_links.
 * Siehe docs/analysis/shadow-twin-metadata-to-secretary-context.md
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

  /**
   * Metadaten aus dem Shadow-Twin-Frontmatter (attachments_url, attachment_links, url, video_url, …).
   * Werden in den Korpus-Kontext geschrieben, damit der Secretary diese Felder für die Transformation nutzen kann.
   */
  sourceMetadata?: Record<string, unknown>

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
      // Shadow-Twin-Metadaten (attachments_url, attachment_links, url, video_url, …) in den Kontext,
      // damit der Secretary diese für die Transformation nutzen kann (z. B. attachment_links).
      const metaLines: string[] = []
      if (source.sourceMetadata && Object.keys(source.sourceMetadata).length > 0) {
        for (const [k, v] of Object.entries(source.sourceMetadata)) {
          if (v != null && v !== '' && typeof v === 'string') {
            metaLines.push(`${k}: ${v}`)
          } else if (Array.isArray(v) && v.length > 0) {
            metaLines.push(`${k}: ${v.map((x) => String(x)).join(', ')}`)
          }
        }
        if (metaLines.length > 0) {
          metaLines.unshift('Metadaten aus Shadow-Twin:')
        }
      }
      // WICHTIG: Für LLM immer den extrahierten Text verwenden, nicht die Summary
      let bodyContent = source.extractedText?.trim() || ''
      if (!bodyContent && source.summary) {
        bodyContent = source.summary.trim()
      }
      content =
        metaLines.length > 0
          ? bodyContent
            ? `${metaLines.join('\n')}\n\n${bodyContent}`
            : metaLines.join('\n')
          : bodyContent
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
 * Baut ein vollständiges Transkript-Markdown für Shadow-Twin-Persistierung.
 *
 * Aufbau:
 * 1. Frontmatter mit `kind: transcript`, `sourceCount`, `createdAt`
 * 2. Quellen-Referenzen als Wikilinks (Dateien), Markdown-Links (URLs), Timestamps (Text)
 * 3. Trennlinie
 * 4. Korpus-Text (aus buildCorpusText)
 *
 * Damit sieht das Transkript im File-Preview identisch strukturiert aus wie bei Audio/PDF:
 * Man sieht oben die Quellen, darunter den gesamten Rohtext.
 *
 * @param sources Liste aller Wizard-Quellen
 * @returns Vollständiges Markdown mit Frontmatter und Quellen-Referenzen
 */
export function buildTranscriptMarkdown(sources: WizardSource[]): string {
  const now = new Date().toISOString()
  const corpusText = buildCorpusText(sources)

  // Frontmatter
  const frontmatter = [
    '---',
    'kind: transcript',
    `sourceCount: ${sources.length}`,
    `createdAt: ${now}`,
    '---',
  ].join('\n')

  // Quellen-Referenzen (sortiert wie im Korpus)
  const sorted = [...sources].sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt))
  const refLines: string[] = []
  for (const source of sorted) {
    if (source.kind === 'file' && source.fileName) {
      // Wikilink für Dateien
      refLines.push(`- [[${source.fileName}]] (Datei)`)
    } else if (source.kind === 'url' && source.url) {
      // Markdown-Link für URLs; Titel aus Summary (erste Zeile) oder URL
      const label = source.summary?.split('\n')[0]?.trim() || source.url
      refLines.push(`- [${label}](${source.url}) (Webseite)`)
    } else if (source.kind === 'text') {
      const dateStr = toIsoSlice(source.createdAt)
      refLines.push(`- Diktat vom ${dateStr} (Text)`)
    }
  }

  const refsBlock = refLines.length > 0
    ? `\n# Quellen\n\n${refLines.join('\n')}\n\n---\n`
    : ''

  // Zusammensetzen: Frontmatter + Quellen-Referenzen + Korpus-Text
  return `${frontmatter}\n${refsBlock}\n${corpusText}\n`
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




