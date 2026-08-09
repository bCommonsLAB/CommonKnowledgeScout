/**
 * @fileoverview Bild-Registrierung aus dem Storage (Engine-Baustein)
 *
 * @description
 * Welle 5b: Die frueher hier liegende Entscheidungslogik (reconstructFromFolder)
 * ist in die Sync-Engine gewandert — reconstruct-Route und Lazy-Resolve fahren
 * einen Engine-Repair im sourceIds-Scope. Uebrig bleiben die Bild-Bausteine:
 * `page_*`/`preview_*` aus dem Twin-Ordner nach Azure spiegeln und als
 * binaryFragments registrieren (register-image-fragments, B1).
 *
 * Wird verwendet von:
 * - sync-engine/execute-source-plan.ts (Operation register-image-fragments)
 * - sync-engine/collect-source-input.ts (Zaehlung rekonstruierbarer Bilder)
 *
 * @module shadow-twin
 */

import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { LibraryService } from '@/lib/services/library-service'
import { FileLogger } from '@/lib/debug/logger'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

/** Bekannte Bild-Endungen fuer Seiten-Renderings/Previews. */
const IMAGE_EXT_RE = /\.(jpe?g|png|webp)$/i
/** Seiten-Renderings (HighRes): page_001.jpeg etc. */
const PAGE_RENDER_RE = /^page_(\d+)\.(jpe?g|png|webp)$/i
/** Vorschau-Bilder (Thumbnails): preview_001.jpg etc. */
const PREVIEW_RE = /^preview_(\d+)\.(jpe?g|png|webp)$/i

/**
 * True, wenn die Datei ein registrierbares Seiten-Rendering/Preview ist
 * (page_NNN.* / preview_NNN.*). Genutzt fuer die Dry-Run-Zaehlung im Reconcile.
 */
export function isReconstructablePageImage(name: string): boolean {
  return IMAGE_EXT_RE.test(name) && (PAGE_RENDER_RE.test(name) || PREVIEW_RE.test(name))
}

/** MIME-Type aus Dateiendung ableiten (nur Bild-Formate). */
function imageMimeFromName(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

/** 1-basierte Seitennummer aus page_NNN/preview_NNN extrahieren (oder undefined). */
function parsePageNumber(name: string): number | undefined {
  const match = name.match(/_(\d+)\./)
  if (!match) return undefined
  const num = Number.parseInt(match[1], 10)
  return Number.isFinite(num) ? num : undefined
}

/**
 * Spiegelt nicht im Markdown referenzierte Seiten-Renderings/Previews
 * (page_*, preview_*) aus dem Shadow-Twin-Ordner nach Azure und registriert sie
 * als binaryFragments. Nur im Mongo-Modus (Azure ist dort die Lese-Quelle); im
 * reinen Filesystem-Modus liegen die Bilder bereits am primaeren Ort.
 */
export async function reconstructPageImages(args: {
  provider: StorageProvider
  libraryId: string
  userEmail: string
  sourceItem: StorageItem
  parentId: string
  items: StorageItem[]
}): Promise<number> {
  const { provider, libraryId, userEmail, sourceItem, parentId, items } = args

  const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
  if (!library) return 0

  const imageFiles = items.filter((it) => it.type === 'file' && isReconstructablePageImage(it.metadata.name))
  if (imageFiles.length === 0) return 0

  const service = new ShadowTwinService({
    library,
    userEmail,
    sourceId: sourceItem.id,
    sourceName: sourceItem.metadata.name,
    parentId,
    provider,
  })

  let mirrored = 0
  for (const img of imageFiles) {
    const name = img.metadata.name
    const isPageRender = PAGE_RENDER_RE.test(name)
    try {
      const { blob } = await provider.getBinary(img.id)
      const buffer = Buffer.from(await blob.arrayBuffer())
      await service.uploadBinaryFragment({
        buffer,
        fileName: name,
        mimeType: imageMimeFromName(name),
        kind: 'image',
        variant: isPageRender ? 'page-render' : 'preview',
        pageNumber: parsePageNumber(name),
      })
      mirrored++
    } catch (err) {
      // Einzel-Bild-Fehler darf den Gesamtlauf nicht abbrechen.
      FileLogger.warn('shadow-twins/reconstruct', 'Bild-Spiegelung fehlgeschlagen', {
        sourceId: sourceItem.id, fileName: name,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (mirrored > 0) {
    FileLogger.info('shadow-twins/reconstruct', `Seiten-Renderings/Previews gespiegelt: ${mirrored}`, {
      sourceId: sourceItem.id,
    })
  }
  return mirrored
}
