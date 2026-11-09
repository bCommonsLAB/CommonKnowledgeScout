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
  STORY_CARDS,
  type StoryCards,
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

function isStoryCards(value: string): value is StoryCards {
  return (STORY_CARDS as readonly string[]).includes(value)
}

/** Name eines Regelsatzes: wie ein Schluessel, klein, ohne Leerzeichen (gleiche Regel wie `REGELSATZ_NAME_RE` in antwortregeln.ts). */
const RULES_NAME_RE = /^[a-z0-9][a-z0-9_-]*$/

export interface SectionAttrs {
  layout: SectionLayout
  bg: SectionBg
  kicker?: string
  imageWidth?: SectionImageWidth
  imageAlign?: SectionImageAlign
  placeholder?: string
  filter?: Record<string, string[]>
  citationsVisible?: boolean
  cards?: StoryCards
  rules?: string
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
  let cards: StoryCards | undefined
  let rules: string | undefined
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
    } else if (key === 'cards') {
      if (!isStoryCards(value)) {
        throw new Error(`Ungueltiges section cards="${value}". Erlaubt: ${STORY_CARDS.join(', ')}`)
      }
      cards = value
    } else if (key === 'rules') {
      const name = value.trim()
      if (!RULES_NAME_RE.test(name)) {
        throw new Error(`Ungueltiges section rules="${value}". Erwartet den Namen eines Regelsatzes der Library (klein, a-z, 0-9, - und _)`)
      }
      rules = name
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
  if (cards !== undefined && layout !== 'story') {
    throw new Error(`section cards gilt nur fuer layout=story (hier: ${layout})`)
  }
  if (rules !== undefined && layout !== 'story') {
    throw new Error(`section rules gilt nur fuer layout=story (hier: ${layout})`)
  }
  const hatBildspalte = layout === 'image-left' || layout === 'image-right'
  if (!hatBildspalte && (imageWidth || imageAlign)) {
    throw new Error(
      `section image_width/image_align gelten nur fuer layout=image-left oder image-right (hier: ${layout})`,
    )
  }
  return { layout, bg, kicker, imageWidth, imageAlign, placeholder, filter, citationsVisible, cards, rules }
}
