/**
 * @fileoverview Facetten-Bindung im Template-Schritt eines Jobs: Schema der Library
 * laden, Platzhalter einsetzen.
 *
 * @description
 * Die Library wird nur geladen, wenn die Vorlage ueberhaupt einen Platzhalter
 * traegt — fuer alle anderen Vorlagen aendert sich nichts. Ein nicht
 * aufloesbarer Platzhalter laesst den Job im Template-Schritt scheitern, BEVOR
 * das Sprachmodell bezahlt wird.
 *
 * @module external-jobs
 */

import { LibraryService } from '@/lib/services/library-service'
import { hatFacettenPlatzhalter, setzeFacettenPlatzhalter, type BindungsFacette } from './facetten-bindung'

export interface FacettenBindung {
  /** Vorlage mit eingesetzten Platzhaltern (unveraendert ohne Platzhalter). */
  content: string
  /** metaKeys der Felder, deren Werte nach der Transformation geprueft werden. */
  gebunden: string[]
  facetten: BindungsFacette[]
}

/** Facetten-Schema einer Library (`chat.gallery.facets`), leer ohne Schema. */
export async function ladeBindungsFacetten(userEmail: string, libraryId: string): Promise<BindungsFacette[]> {
  const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
  if (!library) throw new Error(`Library ${libraryId} nicht gefunden — Facetten-Platzhalter der Vorlage nicht auflösbar`)
  const facets: unknown = library.config?.chat?.gallery?.facets
  if (!Array.isArray(facets)) return []
  return facets.filter((f): f is BindungsFacette => f !== null && typeof f === 'object' && typeof (f as { metaKey?: unknown }).metaKey === 'string')
}

export async function bindeFacettenAnVorlage(templateContent: string, userEmail: string, libraryId: string): Promise<FacettenBindung> {
  if (!hatFacettenPlatzhalter(templateContent)) return { content: templateContent, gebunden: [], facetten: [] }
  const facetten = await ladeBindungsFacetten(userEmail, libraryId)
  const { content, gebunden } = setzeFacettenPlatzhalter(templateContent, facetten)
  return { content, gebunden, facetten }
}
