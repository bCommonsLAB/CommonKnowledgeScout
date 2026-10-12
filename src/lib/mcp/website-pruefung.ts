/**
 * @fileoverview Pruefung eines Markdown-Dokuments VOR dem Publizieren (B1/B5).
 *
 * @description
 * Reine Funktionen ohne I/O: Frontmatter lesen, Pflichtfelder der Registry
 * pruefen, bei `detailViewType: website` die Sektions-Marker parsen und
 * Bild-URLs auf anonyme Lesbarkeit pruefen. Warnungen werden GENANNT, nicht
 * still korrigiert (no-silent-fallbacks): Publizieren entscheidet der
 * Aufrufer mit `trotzWarnungen`.
 *
 * @module mcp
 */

import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { getRequiredFields, isValidDetailViewType } from '@/lib/detail-view-types/registry'
import { parseWebsiteSections } from '@/lib/website/parse-website-sections'

export interface DokumentPruefung {
  meta: Record<string, unknown>
  body: string
  /** `detailViewType` aus dem Frontmatter, sofern gueltig. */
  detailViewType: string | null
  /** Auffaelligkeiten, die das Publizieren nicht verhindern muessen. */
  warnungen: string[]
  /** Harte Fehler: ohne Text oder ungueltiger Typ — es wird NICHT publiziert. */
  fehler: string[]
}

/** Werte von `hero_layout`, die der Renderer kennt (website-detail.tsx); `none` = kein Kopf. */
export const HERO_LAYOUTS: readonly string[] = ['overlay', 'cover', 'campaign', 'none']

/** Bild-URL, die ein anonymer Besucher laden kann: absolut, http(s). */
const ANONYM_LESBAR = /^https?:\/\//i

const BILD_RE = /!\[[^\]]*\]\(([^)\s]+)\)/g

/** Alle Bild-Ziele im Markdown (Markdown-Bildsyntax). */
export function bildUrls(markdown: string): string[] {
  const urls: string[] = []
  for (const treffer of markdown.matchAll(BILD_RE)) urls.push(treffer[1])
  return urls
}

/**
 * Prueft ein Markdown-Dokument fuer das Publizieren. Liest nur den Text.
 */
export function pruefeMarkdownDokument(markdown: string): DokumentPruefung {
  const { meta, body } = parseFrontmatter(markdown)
  const warnungen: string[] = []
  const fehler: string[] = []

  if (!body.trim()) fehler.push('Kein Text unter dem Frontmatter — nichts zu publizieren')

  const typRoh = meta['detailViewType']
  let detailViewType: string | null = null
  if (typeof typRoh !== 'string' || !typRoh.trim()) {
    warnungen.push('detailViewType fehlt im Frontmatter — der Eintrag bekommt den Standardtyp der Library')
  } else if (!isValidDetailViewType(typRoh)) {
    fehler.push(`Unbekannter detailViewType "${typRoh}"`)
  } else {
    detailViewType = typRoh
    for (const feld of getRequiredFields(typRoh)) {
      const wert = meta[feld]
      if (wert === undefined || wert === null || (typeof wert === 'string' && !wert.trim())) {
        warnungen.push(`Pflichtfeld "${feld}" fuer ${typRoh} fehlt`)
      }
    }
  }

  if (detailViewType === 'website') {
    try {
      parseWebsiteSections(body)
    } catch (error) {
      // Der Parser wirft bei ungueltigem layout/bg — genau diese Meldung soll der Aufrufer sehen.
      fehler.push(`Sektions-Marker: ${error instanceof Error ? error.message : String(error)}`)
    }
    const heroBild = meta['hero_image']
    // hero_layout: ein unbekannter Wert faellt im Renderer still auf overlay zurueck — hier wird er genannt.
    const heroLayout = meta['hero_layout']
    if (heroLayout !== undefined && heroLayout !== null) {
      if (typeof heroLayout !== 'string' || !HERO_LAYOUTS.includes(heroLayout)) {
        warnungen.push(`hero_layout "${String(heroLayout)}" ist unbekannt (erlaubt: ${HERO_LAYOUTS.join(', ')}) — der Renderer zeigt den Standard-Kopf`)
      } else if (heroLayout === 'none' && typeof heroBild === 'string' && heroBild.trim()) {
        warnungen.push('hero_layout none mit hero_image: das Bild wird nicht gezeigt — als Sektion full-image in den Body setzen oder hero_layout aendern')
      }
    }
    const kandidaten = [...bildUrls(body), ...(typeof heroBild === 'string' && heroBild ? [heroBild] : [])]
    for (const url of kandidaten) {
      if (!ANONYM_LESBAR.test(url)) {
        warnungen.push(`Bild "${url}" ist keine absolute http(s)-URL — anonyme Besucher koennen es nicht laden`)
      }
    }
  }

  return { meta, body, detailViewType, warnungen, fehler }
}
