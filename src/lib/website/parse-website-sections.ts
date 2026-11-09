/**
 * Parser fuer die Sektions-Konvention im Webseiten-Body (detailViewType: website).
 *
 * Konvention (Obsidian-kompatibel, parser-unabhaengig):
 *
 *   <!-- section layout=image-right bg=light -->
 *   ## Ueberschrift
 *   ![alt](bild-url)
 *   Absatz ...
 *   <!-- /section -->
 *
 * - `layout` und `bg` sind optional; fehlen sie, gelten die Defaults.
 * - `image_width=1/3` und `image_align=top` (nur image-left/image-right):
 *   schmale Bildspalte bzw. obenbuendiges Bild; fehlen sie, bleibt es bei
 *   halber Spalte und mittiger Ausrichtung.
 * - Ungueltige Werte werfen einen Fehler (kein Silent Fallback,
 *   siehe no-silent-fallbacks.mdc) — auch ein Bild-Attribut an einem
 *   Layout ohne Bildspalte.
 * - Body ohne Marker => eine einzige Default-Sektion (Robustheit).
 * - Attribute und ihre Pruefung: `parse-section-attrs.ts`.
 * - `layout=story` (Welle N1): `placeholder="…"` fuer das Eingabefeld (nur
 *   dort erlaubt); der Block `<!-- questions -->` darf NUR in einer
 *   Story-Sektion stehen, und es gibt hoechstens EINE Story-Sektion je Seite
 *   (Sitzung und Story-Zustand sind geteilt). Beides wirft.
 */

import type { WebsiteSection } from './types'
import { parseSectionBlocks } from './parse-section-blocks'
import { DEFAULT_BG, DEFAULT_LAYOUT, parseAttrs } from './parse-section-attrs'
import { pruefeStorySektionen } from './story-section'

const SECTION_RE = /<!--\s*section\b([^>]*?)-->([\s\S]*?)<!--\s*\/section\s*-->/g
const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/
// Video-URL: bevorzugt Markdown-Link [text](url), sonst erste nackte http(s)-URL.
const VIDEO_LINK_RE = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/
const VIDEO_URL_RE = /(https?:\/\/[^\s)]+)/

function extractImage(markdown: string): {
  imageUrl?: string
  imageAlt?: string
  rest: string
} {
  const m = markdown.match(IMAGE_RE)
  if (!m) return { rest: markdown.trim() }
  const rest = markdown.replace(m[0], '').replace(/\n{3,}/g, '\n\n').trim()
  return { imageUrl: m[2], imageAlt: m[1] || undefined, rest }
}

/** Extrahiert die erste Video-URL (Markdown-Link oder nackte URL) aus einer video-Sektion. */
function extractVideoUrl(markdown: string): { videoUrl?: string; rest: string } {
  const link = markdown.match(VIDEO_LINK_RE)
  if (link) {
    const rest = markdown.replace(link[0], '').replace(/\n{3,}/g, '\n\n').trim()
    return { videoUrl: link[1], rest }
  }
  const url = markdown.match(VIDEO_URL_RE)
  if (url) {
    const rest = markdown.replace(url[0], '').replace(/\n{3,}/g, '\n\n').trim()
    return { videoUrl: url[1], rest }
  }
  return { rest: markdown.trim() }
}

/** Zerlegt den Body in Inhalts-Sektionen. */
export function parseWebsiteSections(body: string): WebsiteSection[] {
  const sections: WebsiteSection[] = []
  SECTION_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = SECTION_RE.exec(body)) !== null) {
    const { layout, bg, kicker, imageWidth, imageAlign, placeholder, filter } = parseAttrs(match[1] ?? '')
    if (layout === 'story') {
      // Kein Bild-Auszug: Markdown bleibt ganz, der Rahmen zeigt es vor und nach dem Fragen-Block.
      const rest = (match[2] ?? '').trim()
      sections.push({ layout, bg, markdown: rest, kicker, blocks: parseSectionBlocks(rest), ...(placeholder ? { placeholder } : {}), ...(filter ? { filter } : {}) })
    } else if (layout === 'video') {
      const { videoUrl, rest } = extractVideoUrl(match[2] ?? '')
      sections.push({ layout, bg, markdown: rest, videoUrl, kicker, blocks: parseSectionBlocks(rest) })
    } else {
      const { imageUrl, imageAlt, rest } = extractImage(match[2] ?? '')
      sections.push({
        layout, bg, markdown: rest, imageUrl, imageAlt, kicker, blocks: parseSectionBlocks(rest),
        ...(imageWidth ? { imageWidth } : {}),
        ...(imageAlign ? { imageAlign } : {}),
      })
    }
  }
  if (sections.length === 0) {
    const { imageUrl, imageAlt, rest } = extractImage(body)
    const einzige: WebsiteSection[] = [{ layout: DEFAULT_LAYOUT, bg: DEFAULT_BG, markdown: rest, imageUrl, imageAlt, blocks: parseSectionBlocks(rest) }]
    pruefeStorySektionen(einzige)
    return einzige
  }
  pruefeStorySektionen(sections)
  return sections
}
