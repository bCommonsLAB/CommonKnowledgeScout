/**
 * @fileoverview Hilfen für die Markdown-Vorschau bei `kind: composite-transcript`.
 *
 * - Mongo-only: fehlende zweite Zeile „Transkript prüfen“ wird als HTML-Link gleichen Stils ergänzt.
 * - PDF-Fragment-Wikilinks `[[doc.pdf#x.jpeg]]` → Platzhalter-<img> für async URL-Auflösung.
 */

import { isImageMediaFromName } from '@/lib/media-types'

/** Minimal escapen für HTML-Attribute in injizierten Markdown-HTML-Snippets */
export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Unter `## Quellen`: nach jeder Zeile `- [[Quelle]]`, die keine .md-Quelle ist,
 * eine klickbare „Transkript prüfen“-Zeile einfügen — nur wenn die nächste Zeile
 * noch keinen Transkript-Hinweis enthält (z. B. bereits `[[…|Transkript prüfen]]` aus FS-Persistenz).
 */
export function injectMongoTranscriptCheckLinks(markdownBody: string): string {
  const lines = markdownBody.split('\n')
  const out: string[] = []
  let inQuellen = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedHeader = line.trim()

    if (trimmedHeader === '## Quellen') {
      inQuellen = true
      out.push(line)
      continue
    }

    if (inQuellen && trimmedHeader.startsWith('## ') && trimmedHeader !== '## Quellen') {
      inQuellen = false
    }

    out.push(line)

    if (!inQuellen) continue

    const m = line.match(/^- \[\[([^\]]+)\]\]\s*$/)
    if (!m) continue

    const sourceName = m[1]
    if (sourceName.toLowerCase().endsWith('.md')) continue
    if (isImageMediaFromName(sourceName)) continue

    const nextLine = lines[i + 1] ?? ''
    if (nextLine.includes('Transkript prüfen')) continue

    const safe = escapeHtmlAttr(sourceName)
    out.push(
      `  - <a href="#" class="text-primary underline-offset-2 hover:underline ks-composite-transcript-check cursor-pointer" data-ks-source-name="${safe}">Transkript prüfen</a>`
    )
  }

  return out.join('\n')
}

/**
 * Ersetzt `[[pdf#fragment.png]]` (nur Bild-Fragmente) durch ein <img>-Platzhalter-Element,
 * das der Client per resolve-binary-url mit `data-wikilink-source` / `data-wikilink-fragment` füllt.
 */
export function replaceCompositePdfImageWikilinksWithPlaceholders(markdownBody: string): string {
  return markdownBody.replace(
    /\[\[([^#\[\]]+)#([^\]]+\.(?:jpe?g|png|gif|webp))\]\]/gi,
    (_full, sourceFile: string, frag: string) => {
      const s = escapeHtmlAttr(sourceFile)
      const f = escapeHtmlAttr(frag)
      return `<img class="ks-wikilink-fragment block max-w-full h-auto my-2 rounded border border-muted" data-wikilink-source="${s}" data-wikilink-fragment="${f}" alt="${f}" />`
    }
  )
}
