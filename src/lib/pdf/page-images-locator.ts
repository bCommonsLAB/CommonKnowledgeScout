/**
 * @fileoverview PDF Page Images Locator
 *
 * @description
 * Findet die in der Phase-1-Extraktion erzeugten HighRes-Seitenrenderings
 * (200 DPI, Mistral-OCR `pages_archive` mit `includeHighResPages=true`) zu einem
 * PDF wieder. Vorschau-Bilder (`preview_NNN.jpg`, ~360 px) werden bewusst nicht
 * geliefert, weil sie fuer die Weiterverarbeitung (Split-Pages, Bild-Analyse)
 * zu niedrig aufgeloest sind.
 *
 * Der Locator unterstuetzt beide Persistenz-Modi:
 *  - Mongo-only: Bilder liegen als `binaryFragments` mit `variant='page-render'`
 *    (HighRes) und absoluter Azure-URL im Shadow-Twin-Dokument.
 *  - Filesystem (oder Filesystem-Backup): Bilder liegen als `page_NNN.<ext>` im
 *    Shadow-Twin-Ordner neben dem PDF.
 *
 * Wenn beide Quellen kein Treffer liefern, wirft der Locator einen Fehler mit
 * `code = 'no_page_images'`. Damit kann die API-Route 422 antworten und der
 * Anwender bekommt die klare Meldung "Bitte zuerst Phase 1 Extraktion mit
 * includeHighResPages=true erneut laufen lassen".
 *
 * Hinweis zur Heuristik: Alte Mongo-Dokumente (vor Variante-1-Fix) haben in
 * `binaryFragments` ggf. kein `variant`-Feld. In diesem Fall wird `name` per
 * Pattern `^page[_-]\\d+\\.(png|jpe?g)$` ausgewertet. Das ist deterministisch
 * sicher, weil dieses Naming aus `ImageExtractionService.saveZipArchive` stammt
 * und nur fuer HighRes-Seitenrenderings verwendet wird (Preview-Bilder heissen
 * `preview_NNN.jpg` und matchen das Pattern bewusst nicht).
 *
 * @module pdf
 *
 * @usedIn
 * - src/app/api/library/[libraryId]/pdf/split-pages-to-images/route.ts
 */

import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import { findShadowTwinFolder } from '@/lib/storage/shadow-twin'
import { getShadowTwinBinaryFragments } from '@/lib/repositories/shadow-twin-repo'
import { FileLogger } from '@/lib/debug/logger'

/** Ein gefundenes Seitenbild, einsatzbereit fuer den Upload ins Working-Dir. */
export interface LocatedPageImage {
  /** 1-basierte Seitennummer. */
  pageNumber: number
  /**
   * Technischer Datei-Basisname im Shadow-Twin (immer `page_NNN.<ext>`).
   * NICHT der spaeter im Working-Dir verwendete sprechende Name - der wird in
   * der API-Route via `page-filename-heuristic.ts` ergaenzt.
   */
  fileName: string
  /** MIME-Type, z.B. `image/png` oder `image/jpeg`. */
  mimeType: string
  /** Geladener Bild-Inhalt als Blob (vom Caller in einen `File` verpackt). */
  blob: Blob
}

export class NoPageImagesError extends Error {
  /** Stabiler Code fuer API-Antwort 422. */
  readonly code = 'no_page_images' as const
  constructor(message: string) {
    super(message)
    this.name = 'NoPageImagesError'
  }
}

/** Ergebnis-Typ inkl. Quelle, damit der Aufrufer im Trace dokumentieren kann, welcher Pfad lief. */
export interface LocatePageImagesResult {
  pages: LocatedPageImage[]
  source: 'mongo' | 'filesystem'
}

/** Erkennt anhand des Dateinamens die 1-basierte Seitennummer (Standard-Naming aus der Pipeline). */
function parsePageNumberFromFileName(name: string): number | null {
  const m = name.match(/^page[_-](\d+)\.(png|jpe?g)$/i)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) && n >= 1 ? n : null
}

/** Mappt eine Datei-Endung auf den passenden MIME-Type (verlustfrei normalisiert). */
function mimeTypeForExtension(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  return 'application/octet-stream'
}

/**
 * Mongo-Pfad: lese binaryFragments, filtere Page-Renderings, lade Bilder via fetch().
 *
 * Reihenfolge der Erkennung:
 *  1) `variant === 'page-render'` und `pageNumber` gesetzt (neu seit Variante-1-Fix).
 *  2) Heuristisch ueber `name` (Pattern), als Backwards-Compat fuer alte Dokumente.
 */
async function locateFromMongo(
  libraryId: string,
  sourceId: string
): Promise<LocatedPageImage[]> {
  const fragments = await getShadowTwinBinaryFragments(libraryId, sourceId)
  if (!fragments || fragments.length === 0) return []

  type Candidate = { pageNumber: number; fileName: string; mimeType: string; url: string }
  const candidates: Candidate[] = []

  for (const f of fragments) {
    if (f.kind && f.kind !== 'image') continue
    if (!f.url) continue
    // Thumbnails (variant='thumbnail', preview_NNN.jpg) sind fuer die Weiterverarbeitung
    // zu klein. Wenn das Variant-Feld explizit gesetzt ist, ueberspringen wir alles, was
    // nicht 'page-render' ist (also 'thumbnail', 'preview', 'original').
    if (f.variant && f.variant !== 'page-render') continue

    let pageNumber: number | null = null
    if (f.variant === 'page-render' && typeof f.pageNumber === 'number') {
      pageNumber = f.pageNumber
    } else if (f.name) {
      // Backwards-Compat fuer alte Dokumente ohne variant-Feld:
      // Pattern matcht nur ^page[_-]\d+\.(png|jpe?g)$, sodass preview_NNN.jpg
      // ohnehin nicht greift.
      pageNumber = parsePageNumberFromFileName(f.name)
    }
    if (pageNumber == null) continue

    candidates.push({
      pageNumber,
      fileName: f.name || `page_${String(pageNumber).padStart(3, '0')}.png`,
      mimeType: f.mimeType || mimeTypeForExtension(f.name || ''),
      url: f.url,
    })
  }

  if (candidates.length === 0) return []

  candidates.sort((a, b) => a.pageNumber - b.pageNumber)

  const pages: LocatedPageImage[] = []
  for (const c of candidates) {
    try {
      // Direktes fetch der absoluten Azure-URL (Container ist public bzw. URL enthaelt SAS).
      // Wenn das fehlschlaegt (z.B. private Container ohne SAS), faellt die Route auf 500
      // mit klarer Fehlermeldung; das ist besser als ein silent skip.
      const res = await fetch(c.url)
      if (!res.ok) {
        FileLogger.warn('page-images-locator', 'Bild konnte nicht geladen werden', {
          url: c.url,
          status: res.status,
        })
        continue
      }
      const blob = await res.blob()
      pages.push({
        pageNumber: c.pageNumber,
        fileName: c.fileName,
        mimeType: c.mimeType,
        blob,
      })
    } catch (error) {
      FileLogger.warn('page-images-locator', 'Fehler beim Laden eines Page-Bildes (Mongo)', {
        url: c.url,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return pages
}

/**
 * Filesystem-Pfad: finde Shadow-Twin-Folder neben dem PDF, lese alle `page_NNN.*`-Dateien.
 */
async function locateFromFilesystem(
  provider: StorageProvider,
  sourceItem: StorageItem
): Promise<LocatedPageImage[]> {
  const parentId = sourceItem.parentId || 'root'
  const folder = await findShadowTwinFolder(parentId, sourceItem.metadata.name, provider)
  if (!folder) return []

  const items = await provider.listItemsById(folder.id)
  // Wir gehen NICHT rekursiv - die Pipeline legt Page-Bilder direkt im Shadow-Twin-Ordner ab.
  type Candidate = { pageNumber: number; item: StorageItem }
  const candidates: Candidate[] = []
  for (const it of items) {
    if (it.type !== 'file') continue
    const pageNumber = parsePageNumberFromFileName(it.metadata.name)
    if (pageNumber == null) continue
    candidates.push({ pageNumber, item: it })
  }
  if (candidates.length === 0) return []
  candidates.sort((a, b) => a.pageNumber - b.pageNumber)

  const pages: LocatedPageImage[] = []
  for (const c of candidates) {
    try {
      const { blob } = await provider.getBinary(c.item.id)
      pages.push({
        pageNumber: c.pageNumber,
        fileName: c.item.metadata.name,
        mimeType: c.item.metadata.mimeType || mimeTypeForExtension(c.item.metadata.name),
        blob,
      })
    } catch (error) {
      FileLogger.warn('page-images-locator', 'Fehler beim Laden eines Page-Bildes (FS)', {
        fileName: c.item.metadata.name,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return pages
}

/**
 * Sucht alle PDF-Seitenrenderings im Shadow-Twin und liefert sie sortiert zurueck.
 *
 * Reihenfolge: erst Mongo (schneller, deterministisch im azure-only-Modus), dann
 * Filesystem-Fallback (filesystem-only-Modus oder gemischter Modus).
 *
 * @throws NoPageImagesError wenn weder in Mongo noch im Filesystem Page-Bilder
 *         gefunden werden. API-Route uebersetzt das in 422 + `code='no_page_images'`.
 */
export async function locatePageImagesForPdf(args: {
  libraryId: string
  sourceItem: StorageItem
  provider: StorageProvider
}): Promise<LocatePageImagesResult> {
  const { libraryId, sourceItem, provider } = args

  // 1) Mongo zuerst: ist im azure-only-Modus die einzige Quelle und im Misch-Modus
  //    die schnellere (kein Filesystem-Round-Trip).
  const mongoPages = await locateFromMongo(libraryId, sourceItem.id)
  if (mongoPages.length > 0) {
    return { pages: mongoPages, source: 'mongo' }
  }

  // 2) Filesystem-Fallback (nur sinnvoll, wenn provider Filesystem-faehig ist;
  //    wir versuchen es einfach und akzeptieren leeres Ergebnis).
  const fsPages = await locateFromFilesystem(provider, sourceItem)
  if (fsPages.length > 0) {
    return { pages: fsPages, source: 'filesystem' }
  }

  // 3) Beides leer -> harter Fehler, kein silent fallback (siehe no-silent-fallbacks.mdc).
  throw new NoPageImagesError(
    `Keine HighRes-Seitenbilder fuer "${sourceItem.metadata.name}" gefunden. ` +
      'Bitte zuerst Phase 1 Extraktion (Mistral-OCR mit includeHighResPages=true) erneut laufen lassen.'
  )
}
