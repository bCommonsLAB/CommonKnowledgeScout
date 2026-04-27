/**
 * @fileoverview Vorschau-Hilfen fuer `kind: composite-multi`-Markdown.
 *
 * Wandelt den `## Vorschau`-Block (Obsidian-Embeds `![[bild.jpeg]]`) in einen
 * HTML-Grid mit Platzhalter-`<img>`-Tags um. Die finalen `src`-Werte werden
 * im Browser nachgelegt — siehe `markdown-preview.tsx`.
 *
 * Warum dieser Schritt?
 * - Der Standard-Markdown-Renderer wuerde `![[bild.jpeg]]` als Klartext zeigen.
 * - Wir haben aber im Composite-Multi den exakten Dateinamen und im
 *   Sibling-Verzeichnis die fileId, sodass wir einen schoenen Grid bauen
 *   koennen.
 *
 * Begrenzungen:
 * - Wir transformieren NUR den `## Vorschau`-Block, damit Embeds, die der
 *   User vielleicht im Titel/Body haendisch eingebaut hat, vom Standard-
 *   Renderer behandelt werden.
 * - Wir injizieren rohes HTML; das ist unter Markdown-it / `remark-html`
 *   normalerweise erlaubt. Sollte das in einem Renderer streng verboten
 *   sein, faellt der Block visuell zurueck auf Klartext-Embeds.
 */

import { escapeHtmlAttr } from '@/lib/markdown/composite-wiki-preview'

/**
 * CSS-Klassen fuer das Grid und die einzelnen Bilder.
 * Bewusst Tailwind, damit die Vorschau im Standard-Look erscheint.
 */
const GRID_OPEN =
  '<div class="ks-composite-multi-grid grid grid-cols-2 md:grid-cols-3 gap-3 my-4 not-prose">'
const GRID_CLOSE = '</div>'

/**
 * Transformiert den `## Vorschau`-Block in einen Grid mit Platzhalter-`<img>`-Tags.
 *
 * - Erkennt den Block durch die Heading-Zeile `## Vorschau` und stoppt am
 *   naechsten Heading (oder Dateiende).
 * - Jeder Embed `![[name]]` wird zu einem `<img>` mit `data-composite-multi-source`.
 * - Das `src`-Attribut bleibt leer; ein `useEffect` im Preview-Renderer
 *   setzt die echte URL nach.
 *
 * Gibt das Markdown unveraendert zurueck, wenn kein `## Vorschau`-Block
 * gefunden wird.
 */
export function replaceCompositeMultiPreviewBlock(markdownBody: string): string {
  const lines = markdownBody.split('\n')
  const headingIdx = lines.findIndex(l => l.trim() === '## Vorschau')
  if (headingIdx < 0) return markdownBody

  // Block-Ende suchen: naechstes `## ` oder Dateiende.
  let endIdx = lines.length
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) {
      endIdx = i
      break
    }
  }

  // Embed-Namen aus dem Block extrahieren (in Reihenfolge).
  const embedRe = /^\s*!\[\[([^\]]+)\]\]\s*$/
  const names: string[] = []
  for (let i = headingIdx + 1; i < endIdx; i++) {
    const m = lines[i].match(embedRe)
    if (m) names.push(m[1])
  }

  if (names.length === 0) return markdownBody

  // Grid-HTML bauen.
  const imgs = names
    .map(name => {
      const safe = escapeHtmlAttr(name)
      return (
        `<img class="ks-composite-multi-image w-full h-auto rounded border border-muted bg-muted/30" ` +
        `data-composite-multi-source="${safe}" alt="${safe}" loading="lazy" />`
      )
    })
    .join('\n')

  const replacementBlock = ['## Vorschau', '', GRID_OPEN, imgs, GRID_CLOSE, ''].join('\n')

  // Original-Block austauschen.
  const before = lines.slice(0, headingIdx).join('\n')
  const after = lines.slice(endIdx).join('\n')
  // Saubere Trenner zwischen den Bloecken sicherstellen.
  return [before, replacementBlock, after].filter(s => s.length > 0).join('\n')
}
