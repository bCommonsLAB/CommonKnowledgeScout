/**
 * @fileoverview Slide-Bilder (`slides[].image_url`) ueber die Binaerfragmente des
 * eigenen Twins aufloesen.
 *
 * Hintergrund: Die Sammeldatei eines Vortrags registriert per `_media_files` die
 * Seitenbilder des Folien-PDFs als Fragmente an ihrem Twin — sie liegen damit
 * bereits im Blob-Speicher. Die Vorlage laesst das Modell im Feld `slides` nur
 * den nackten Dateinamen (`preview_007.jpg`) angeben, genau wie bei
 * `galleryImageUrls`. Hier wird der Name deterministisch auf die Fragment-URL
 * gehoben; was nicht gefunden wird, bleibt unveraendert und laeuft danach in
 * den Pfad-Upload von `ImageProcessor.processSlideImages`, der jeden Fehler
 * meldet (kein stiller Fallback).
 */

import { FileLogger } from '@/lib/debug/logger'
import { getShadowTwinBinaryFragments } from '@/lib/repositories/shadow-twin-repo'

export interface SlideImageResolution {
  slides: Array<Record<string, unknown>>
  /** Dateinamen, die kein Fragment am Twin hatten (bleiben als Pfad stehen). */
  unresolved: string[]
}

function isBareFileName(value: string): boolean {
  return value.length > 0 && !value.includes('/') && !/^https?:\/\//.test(value)
}

export async function resolveSlideImagesFromTwinFragments(
  libraryId: string,
  fileId: string,
  slides: Array<Record<string, unknown>>,
): Promise<SlideImageResolution> {
  const candidates = slides.filter((s) => typeof s.image_url === 'string' && isBareFileName(s.image_url))
  if (candidates.length === 0) return { slides, unresolved: [] }

  const fragments = await getShadowTwinBinaryFragments(libraryId, fileId)
  const urlByName = new Map<string, string>()
  for (const f of fragments ?? []) {
    if (f.name && f.url) urlByName.set(f.name, f.url)
  }

  const unresolved: string[] = []
  const resolved = slides.map((slide) => {
    const name = slide.image_url
    if (typeof name !== 'string' || !isBareFileName(name)) return slide
    const url = urlByName.get(name)
    if (!url) {
      unresolved.push(name)
      return slide
    }
    return { ...slide, image_url: url }
  })

  FileLogger.info('ingestion', 'Slide-Bilder ueber Twin-Fragmente aufgeloest', {
    fileId,
    candidates: candidates.length,
    resolved: candidates.length - unresolved.length,
    unresolved,
  })
  return { slides: resolved, unresolved }
}
