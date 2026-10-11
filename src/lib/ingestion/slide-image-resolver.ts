/**
 * @fileoverview Folienbilder (`slides[].image_url`) ueber die Binaerfragmente
 * des eigenen Twins UND der Quellen-Twins aufloesen (Welle J2).
 *
 * @description
 * Die Seitenbilder eines Vortrags liegen am Twin der Folien-PDF aus
 * `_source_files` (PDF-Extraktion, `variant: 'thumbnail' | 'page-render'`,
 * `pageNumber`), nicht am Twin der Sammeldatei. Seit Welle E stehen die
 * Quellen als `compositeSources` am Twin der Sammeldatei; hier werden die
 * Fragmente aller Quellen in deterministischer Reihenfolge durchsucht:
 * eigener Twin, dann PDF-Quellen (die mit den meisten Seitenbildern zuerst,
 * bei Gleichstand Reihenfolge der `_source_files`), dann uebrige Quellen.
 *
 * Zuordnung je Folie:
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
import { getShadowTwinsBySourceIds, type ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'

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

interface Fragment {
  name: string
  url: string
  variant?: string
  pageNumber?: number
}

type SeitenVariante = 'thumbnail' | 'page-render'

const SEITENBILD_RE = /^(preview|page)[_-](\d+)\.(png|jpe?g|webp)$/i

function fragmenteAusTwin(doc: ShadowTwinDocument | undefined): Fragment[] {
  const out: Fragment[] = []
  for (const raw of doc?.binaryFragments ?? []) {
    const f = raw as Record<string, unknown>
    if (typeof f.name !== 'string' || typeof f.url !== 'string' || !f.url) continue
    out.push({
      name: f.name,
      url: f.url,
      variant: typeof f.variant === 'string' ? f.variant : undefined,
      pageNumber: typeof f.pageNumber === 'number' ? f.pageNumber : undefined,
    })
  }
  return out
}

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

function nachSeite(fragments: Fragment[], page: number, bevorzugt: SeitenVariante): string | undefined {
  const andere: SeitenVariante = bevorzugt === 'thumbnail' ? 'page-render' : 'thumbnail'
  for (const variante of [bevorzugt, andere]) {
    const hit = fragments.find((f) => f.pageNumber === page && f.variant === variante)
    if (hit) return hit.url
  }
  return undefined
}

function sucheInQuellen(quellen: Array<{ fragments: Fragment[] }>, finde: (f: Fragment[]) => string | undefined): string | undefined {
  for (const q of quellen) {
    const url = finde(q.fragments)
    if (url) return url
  }
  return undefined
}

/** Suchreihenfolge: eigener Twin, PDF-Quellen (meiste Seitenbilder zuerst), Rest. */
export function ordneQuellen(
  eigener: { sourceId: string; sourceName: string; fragments: Fragment[] },
  quellen: Array<{ sourceId: string; sourceName: string; fragments: Fragment[] }>,
): Array<{ sourceId: string; sourceName: string; fragments: Fragment[] }> {
  const seiten = (q: { fragments: Fragment[] }) => q.fragments.filter((f) => typeof f.pageNumber === 'number').length
  const istPdf = (q: { sourceName: string }) => /\.pdf$/i.test(q.sourceName)
  const pdfs = quellen.map((q, i) => ({ q, i })).filter(({ q }) => istPdf(q))
    .sort((a, b) => seiten(b.q) - seiten(a.q) || a.i - b.i).map(({ q }) => q)
  const rest = quellen.filter((q) => !istPdf(q))
  return [eigener, ...pdfs, ...rest]
}

export async function resolveSlideImagesFromTwinFragments(
  libraryId: string,
  fileId: string,
  slides: Array<Record<string, unknown>>,
): Promise<SlideImageResolution> {
  const eigenerTwin = (await getShadowTwinsBySourceIds({ libraryId, sourceIds: [fileId] })).get(fileId)
  const quellenIds = Array.isArray(eigenerTwin?.compositeSources) ? eigenerTwin.compositeSources : []
  const quellenDocs = quellenIds.length > 0 ? await getShadowTwinsBySourceIds({ libraryId, sourceIds: quellenIds }) : new Map<string, ShadowTwinDocument>()

  const quellen = ordneQuellen(
    { sourceId: fileId, sourceName: eigenerTwin?.sourceName ?? '', fragments: fragmenteAusTwin(eigenerTwin) },
    quellenIds.map((id) => {
      const doc = quellenDocs.get(id)
      return { sourceId: id, sourceName: doc?.sourceName ?? '', fragments: fragmenteAusTwin(doc) }
    }),
  )
  const sources: SlideImageSource[] = quellen.map((q) => ({
    sourceId: q.sourceId, sourceName: q.sourceName,
    seitenbilder: q.fragments.filter((f) => typeof f.pageNumber === 'number').length,
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
