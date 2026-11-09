/**
 * Attribute des Sektions-Markers `<!-- section … -->` (aus parse-website-sections.ts
 * herausgeloest, 09.11.2026, Dateigrenze): layout, bg, kicker, image_width,
 * image_align, placeholder (nur story) und filter (nur story, `story-filter.ts`).
 * Ungueltige Werte werfen — kein stiller Fallback.
 */

import { SITE_SURFACES } from '@ks/contracts'
import {
  SECTION_IMAGE_ALIGNS,
  SECTION_IMAGE_WIDTHS,
  type SectionBg,
  type SectionImageAlign,
  type SectionImageWidth,
  type SectionLayout,
} from './types'
import { storyFilterAusAttribut } from './story-filter'

const SECTION_LAYOUTS: readonly SectionLayout[] = [
  'image-left',
  'image-right',
  'full-image',
  'text-only',
  'video',
  'contact-form',
  'banner',
  'story',
]
const SECTION_BGS: readonly SectionBg[] = SITE_SURFACES

export const DEFAULT_LAYOUT: SectionLayout = 'text-only'
export const DEFAULT_BG: SectionBg = 'default'

// Werte ohne Anfuehrungszeichen sind Woerter (`layout=banner`); in
// Anfuehrungszeichen darf alles stehen (`kicker="Wer wir sind"`, S2).
const ATTR_RE = /(\w+)\s*=\s*(?:"([^"]*)"|([\w\/-]+))/g

function isLayout(value: string): value is SectionLayout {
  return (SECTION_LAYOUTS as readonly string[]).includes(value)
}

function isBg(value: string): value is SectionBg {
  return (SECTION_BGS as readonly string[]).includes(value)
}

function isImageWidth(value: string): value is SectionImageWidth {
  return (SECTION_IMAGE_WIDTHS as readonly string[]).includes(value)
}

function isImageAlign(value: string): value is SectionImageAlign {
  return (SECTION_IMAGE_ALIGNS as readonly string[]).includes(value)
}

export interface SectionAttrs {
  layout: SectionLayout
  bg: SectionBg
  kicker?: string
  imageWidth?: SectionImageWidth
  imageAlign?: SectionImageAlign
  placeholder?: string
  filter?: Record<string, string[]>
  citationsVisible?: boolean
}

export function parseAttrs(raw: string): SectionAttrs {
  let layout: SectionLayout = DEFAULT_LAYOUT
  let bg: SectionBg = DEFAULT_BG
  let kicker: string | undefined
  let imageWidth: SectionImageWidth | undefined
  let imageAlign: SectionImageAlign | undefined
  let placeholder: string | undefined
  let filter: Record<string, string[]> | undefined
  let citationsVisible: boolean | undefined
  ATTR_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTR_RE.exec(raw)) !== null) {
    const key = m[1]
    const value = m[2] ?? m[3]
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
    } else if (key === 'kicker') {
      kicker = value.trim() || undefined
    } else if (key === 'image_width') {
      if (!isImageWidth(value)) {
        throw new Error(`Ungueltiges section image_width="${value}". Erlaubt: ${SECTION_IMAGE_WIDTHS.join(', ')}`)
      }
      imageWidth = value
    } else if (key === 'image_align') {
      if (!isImageAlign(value)) {
        throw new Error(`Ungueltiges section image_align="${value}". Erlaubt: ${SECTION_IMAGE_ALIGNS.join(', ')}`)
      }
      imageAlign = value
    } else if (key === 'placeholder') {
      placeholder = value.trim() || undefined
    } else if (key === 'filter') {
      filter = storyFilterAusAttribut(value)
    } else if (key === 'citations') {
      if (value !== 'visible' && value !== 'hidden') {
        throw new Error(`Ungueltiges section citations="${value}". Erlaubt: visible, hidden`)
      }
      citationsVisible = value === 'visible'
    }
  }
  if (placeholder !== undefined && layout !== 'story') {
    throw new Error(`section placeholder gilt nur fuer layout=story (hier: ${layout})`)
  }
  if (filter !== undefined && layout !== 'story') {
    throw new Error(`section filter gilt nur fuer layout=story (hier: ${layout})`)
  }
  if (citationsVisible !== undefined && layout !== 'story') {
    throw new Error(`section citations gilt nur fuer layout=story (hier: ${layout})`)
  }
  const hatBildspalte = layout === 'image-left' || layout === 'image-right'
  if (!hatBildspalte && (imageWidth || imageAlign)) {
    throw new Error(
      `section image_width/image_align gelten nur fuer layout=image-left oder image-right (hier: ${layout})`,
    )
  }
  return { layout, bg, kicker, imageWidth, imageAlign, placeholder, filter, citationsVisible }
}
