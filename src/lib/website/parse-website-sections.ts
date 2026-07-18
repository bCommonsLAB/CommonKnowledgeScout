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
 * - Ungueltige Werte werfen einen Fehler (kein Silent Fallback,
 *   siehe no-silent-fallbacks.mdc).
 * - Body ohne Marker => eine einzige Default-Sektion (Robustheit).
 */

import type { SectionBg, SectionLayout, WebsiteSection } from './types'

const SECTION_LAYOUTS: readonly SectionLayout[] = [
  'image-left',
  'image-right',
  'full-image',
  'text-only',
  'video',
]
const SECTION_BGS: readonly SectionBg[] = [
  'default',
  'light',
  'dark',
  'brand',
  'linen',
  'mint',
  'dark-green',
  'neutral',
]

const DEFAULT_LAYOUT: SectionLayout = 'text-only'
const DEFAULT_BG: SectionBg = 'default'

const SECTION_RE = /<!--\s*section\b([^>]*?)-->([\s\S]*?)<!--\s*\/section\s*-->/g
const ATTR_RE = /(\w+)\s*=\s*"?([\w-]+)"?/g
const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/
// Video-URL: bevorzugt Markdown-Link [text](url), sonst erste nackte http(s)-URL.
const VIDEO_LINK_RE = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/
const VIDEO_URL_RE = /(https?:\/\/[^\s)]+)/

function isLayout(value: string): value is SectionLayout {
  return (SECTION_LAYOUTS as readonly string[]).includes(value)
}

function isBg(value: string): value is SectionBg {
  return (SECTION_BGS as readonly string[]).includes(value)
}

function parseAttrs(raw: string): { layout: SectionLayout; bg: SectionBg } {
  let layout: SectionLayout = DEFAULT_LAYOUT
  let bg: SectionBg = DEFAULT_BG
  ATTR_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTR_RE.exec(raw)) !== null) {
    const key = m[1]
    const value = m[2]
    if (key === 'layout') {
      if (!isLayout(value)) {
        throw new Error(
          `Ungueltiges section layout="${value}". Erlaubt: ${SECTION_LAYOUTS.join(', ')}`,
        )
      }
      layout = value
    } else if (key === 'bg') {
      if (!isBg(value)) {
        throw new Error(
          `Ungueltiges section bg="${value}". Erlaubt: ${SECTION_BGS.join(', ')}`,
        )
      }
      bg = value
    }
  }
  return { layout, bg }
}

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
    const { layout, bg } = parseAttrs(match[1] ?? '')
    if (layout === 'video') {
      const { videoUrl, rest } = extractVideoUrl(match[2] ?? '')
      sections.push({ layout, bg, markdown: rest, videoUrl })
    } else {
      const { imageUrl, imageAlt, rest } = extractImage(match[2] ?? '')
      sections.push({ layout, bg, markdown: rest, imageUrl, imageAlt })
    }
  }
  if (sections.length === 0) {
    const { imageUrl, imageAlt, rest } = extractImage(body)
    return [{ layout: DEFAULT_LAYOUT, bg: DEFAULT_BG, markdown: rest, imageUrl, imageAlt }]
  }
  return sections
}
