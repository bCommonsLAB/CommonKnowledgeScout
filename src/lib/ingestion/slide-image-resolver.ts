/**
 * @fileoverview Folienbilder (`slides[].image_url`) ueber die Binaerfragmente
 * des eigenen Twins UND der Quellen-Twins aufloesen (Welle J2).
 *
 * @description
 * Die Suchreihenfolge der Twins liefert `quellen-fragmente.ts` (eigener Twin,
 * PDF-Quellen mit den meisten Seitenbildern zuerst, Rest). Zuordnung je Folie:
 * 1. exakter Fragmentname (`preview_007.jpeg`),
 * 2. Seitennummer aus dem Namen (`preview_007.jpg` → Seite 7; der Upload
 *    normalisiert `jpg` zu `jpeg`, deshalb reicht der Name allein nicht),
 *    bevorzugt die Variante des Praefixes (preview → thumbnail, page →
 *    page-render), sonst die jeweils andere,
 * 3. ohne `image_url`: Seitennummer aus `page_num` (thumbnail vor page-render),
 *    denn die Vorlage nennt die Seite, die Datei rechnet die Pipeline.
 *
 * Was nicht gefunden wird, bleibt unveraendert in `unresolved` und laeuft wie
 * bisher in den Pfad-Upload von `ImageProcessor.processSlideImages`, der jeden
 * Fehler meldet — kein stiller Platzhalter.
 *
 * @module ingestion
 */

import { FileLogger } from '@/lib/debug/logger'
import { parseTwinRelativeImageRef } from '@ks/util'
import { ladeGeordneteQuellen, nachSeite, seitenbilder, type Fragment, type QuellenTwin, type SeitenVariante } from '@/lib/ingestion/quellen-fragmente'

export interface SlideImageSource {
  sourceId: string
  sourceName: string
  /** Fragmente mit Seitennummer an diesem Twin. */
  seitenbilder: number
}

export interface SlideImageResolution {
  slides: Array<Record<string, unknown>>
  resolved: number
  /** Referenzen ohne Treffer (Dateiname oder `Seite N`), bleiben wie sie sind. */
  unresolved: string[]
  /** Durchsuchte Twins in Suchreihenfolge — fuer Trace und Antwort der Bruecke. */
  sources: SlideImageSource[]
}

const SEITENBILD_RE = /^(preview|page)[_-](\d+)\.(png|jpe?g|webp)$/i

/** Nackter Name oder Twin-relativer Verweis (`_Folien.pdf/preview_001.jpg`) → Blattname; sonst null. */
function blattname(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  if (/^https?:\/\//i.test(value) || value.startsWith('/')) return null
  if (!value.includes('/') && !value.includes('\\')) return value
  return parseTwinRelativeImageRef(value)?.imageFileName ?? null
}

function seitenHinweis(name: string): { page: number; bevorzugt: SeitenVariante } | null {
  const m = name.match(SEITENBILD_RE)
  if (!m) return null
  return { page: parseInt(m[2], 10), bevorzugt: m[1].toLowerCase() === 'preview' ? 'thumbnail' : 'page-render' }
}

function sucheInQuellen(quellen: QuellenTwin[], finde: (f: Fragment[]) => string | undefined): string | undefined {
  for (const q of quellen) {
    const url = finde(q.fragments)
    if (url) return url
  }
  return undefined
}

export async function resolveSlideImagesFromTwinFragments(
  libraryId: string,
  fileId: string,
  slides: Array<Record<string, unknown>>,
): Promise<SlideImageResolution> {
  const quellen = await ladeGeordneteQuellen(libraryId, fileId)
  const sources: SlideImageSource[] = quellen.map((q) => ({
    sourceId: q.sourceId, sourceName: q.sourceName, seitenbilder: seitenbilder(q),
  }))

  const unresolved: string[] = []
  let resolved = 0
  const ergebnis = slides.map((slide) => {
    const leaf = blattname(slide.image_url)
    if (leaf) {
      const hinweis = seitenHinweis(leaf)
      const url = sucheInQuellen(quellen, (f) => f.find((x) => x.name === leaf)?.url)
        ?? (hinweis ? sucheInQuellen(quellen, (f) => nachSeite(f, hinweis.page, hinweis.bevorzugt)) : undefined)
      if (!url) { unresolved.push(leaf); return slide }
      resolved += 1
      return { ...slide, image_url: url }
    }
    const ohneBild = typeof slide.image_url !== 'string' || slide.image_url.trim() === ''
    if (ohneBild && typeof slide.page_num === 'number' && slide.page_num > 0) {
      const url = sucheInQuellen(quellen, (f) => nachSeite(f, slide.page_num as number, 'thumbnail'))
      if (!url) { unresolved.push(`Seite ${slide.page_num}`); return slide }
      resolved += 1
      return { ...slide, image_url: url }
    }
    return slide
  })

  FileLogger.info('ingestion', 'Folienbilder ueber Twin- und Quellen-Fragmente aufgeloest', {
    fileId, slides: slides.length, resolved, unresolved, sources,
  })
  return { slides: ergebnis, resolved, unresolved, sources }
}
