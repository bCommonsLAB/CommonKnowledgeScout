/**
 * Teilt ein Markdown-Dokument anhand von Seitenankern in Seitenbereiche.
 * Erwartetes Ankerformat pro Seite (eigene Zeile):
 * --- Seite N ---
 *
 * Liefert für jede erkannte Seite den Inhaltsspanne-Indexbereich
 * (exklusive der Ankerzeile) innerhalb des Original-Strings zurück.
 */
export interface PageSpan {
  page: number
  /** Startindex des Seiteninhalts (nach der Ankerzeile) */
  startIdx: number
  /** Endindex des Seiteninhalts (exklusiv). Für die letzte Seite = md.length */
  endIdx: number
}

export function splitByPages(markdown: string): PageSpan[] {
  // Multiline, Zeilenweise: exakt die Form "--- Seite N ---" erfassen
  const re = /^---\s*Seite\s*(\d+)\s*---\s*$/gm
  const anchors: Array<{ page: number; anchorStart: number; anchorEnd: number; contentStart: number }> = []

  let match: RegExpExecArray | null
  while ((match = re.exec(markdown))) {
    const pageNo = Number(match[1])
    const anchorStart = match.index
    const anchorEnd = anchorStart + match[0].length
    // Inhalt beginnt nach der Ankerzeile: bis zum Ende der Zeile überspringen
    const newlineIdx = markdown.indexOf('\n', anchorEnd)
    const contentStart = newlineIdx >= 0 ? newlineIdx + 1 : anchorEnd
    anchors.push({ page: pageNo, anchorStart, anchorEnd, contentStart })
  }

  if (anchors.length === 0) return []

  // Enden bestimmen: nächste Anker-Startposition als Ende nehmen; für letzte Seite = Dokumentende
  const spans: PageSpan[] = []
  for (let i = 0; i < anchors.length; i++) {
    const curr = anchors[i]
    const next = anchors[i + 1]
    const endIdx = next ? next.anchorStart : markdown.length
    spans.push({ page: curr.page, startIdx: curr.contentStart, endIdx })
  }
  return spans
}







