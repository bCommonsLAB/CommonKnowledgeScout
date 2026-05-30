/**
 * @fileoverview Lese-Helfer fuer den bestehenden `review_status` einer
 * DIVA-Texturanalyse — Voraussetzung fuer den Override-Schutz im
 * Pass-1-Postprocessor (Stufe 3, Update 2, Lea-Regel #12).
 *
 * @description
 * Nimmt den im Job-State bekannten Shadow-Twin-Artefakt-Pfad (oder das
 * Schwester-Verzeichnis der Quelldatei als Fallback), versucht das
 * Markdown ueber den `ShadowTwinService` zu laden und liest den
 * `review_status` aus dem Frontmatter.
 *
 * Best-Effort: alle erwarteten Misserfolge (kein vorheriger Lauf, kein
 * Markdown, Library nicht gefunden, Parse-Fehler) fuehren zu `undefined`
 * — der Aufrufer faellt dann im Postprocessor auf `nicht_geprueft`
 * zurueck, was deterministisch ueberschreibbar ist.
 *
 * KEIN stiller Fallback im Sinne der no-silent-fallbacks-Regel: das
 * Verhalten ist hier _Spezifikation_ (Override-Schutz greift NUR fuer
 * manuell gesetzte Stati), nicht ein Bug-Verstecker. Fehler werden via
 * FileLogger sichtbar gemacht.
 */

import type { StorageProvider } from '@/lib/storage/types'
import { FileLogger } from '@/lib/debug/logger'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { LibraryService } from '@/lib/services/library-service'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { isReviewStatus, type ReviewStatus } from './review-status'

export interface ReadExistingReviewStatusParams {
  provider: StorageProvider
  libraryUserEmail: string
  libraryId: string
  parentId: string
  sourceName: string
  sourceItemId: string
}

/**
 * Versucht, den bestehenden `review_status` der DIVA-Texturanalyse fuer
 * diese Quelldatei zu lesen. Liefert undefined, wenn es noch keinen
 * vorigen Lauf gibt oder das Markdown nicht gelesen werden konnte —
 * der Aufrufer behandelt das als `nicht_geprueft` (ueberschreibbar).
 */
export async function readExistingDivaReviewStatus(
  params: ReadExistingReviewStatusParams,
): Promise<ReviewStatus | undefined> {
  try {
    const library = await LibraryService.getInstance().getLibrary(params.libraryUserEmail, params.libraryId)
    if (!library) return undefined

    const service = new ShadowTwinService({
      library,
      userEmail: params.libraryUserEmail,
      sourceId: params.sourceItemId,
      sourceName: params.sourceName,
      parentId: params.parentId,
      provider: params.provider,
    })

    // Kein Template-Name bekannt → wir suchen die jeweils zuletzt gespeicherte
    // Transformation. ShadowTwinService.getMarkdown braucht einen ArtifactKey
    // (sourceId + kind + targetLanguage + templateName). Wir koennen die
    // Sprache vom Job noch nicht zuverlaessig wissen, da der Aufrufer (route)
    // sie nicht durchreicht — defaulten auf 'de' (Projekt-Standard).
    //
    // Wenn ein anderes Lang/Template gewuenscht ist, kommt einfach kein
    // Match heraus und wir geben undefined zurueck (= Override-Schutz neu
    // beginnt). Praktisch passt das fuer Stufe 3, weil der Pass-1-Lauf
    // immer mit derselben Sprache + demselben DIVA-Texture-Template lief.
    const result = await service.getMarkdown({
      kind: 'transformation',
      targetLanguage: 'de',
      // Template-Name nicht eindeutig bekannt → leeren String uebergeben
      // (ShadowTwinService matcht dann auf den lookup-Default). Wenn das
      // nicht trifft, ist getMarkdown null und wir liefern undefined.
      templateName: 'Diva-Texture-Analysis',
    })
    if (!result?.markdown) return undefined

    const { meta } = parseFrontmatter(result.markdown)
    if (isReviewStatus(meta.review_status)) return meta.review_status
    return undefined
  } catch (error) {
    FileLogger.warn('diva-texture-read-review-status', 'Konnte bestehenden review_status nicht lesen', {
      libraryId: params.libraryId,
      sourceItemId: params.sourceItemId,
      error: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}
