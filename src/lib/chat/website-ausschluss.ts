/**
 * Erzeugte Webseiten sind keine Quelle (Owner-Entscheid 22.11.2026).
 *
 * Eine Seite mit `detailViewType: website` (Startseite, Unterseiten) fasst
 * die Dokumente der Library zusammen. Als Beleg einer Antwort zitiert sie
 * sich selbst statt der Dokumente dahinter. Sie wird deshalb schon bei der
 * Suche ausgeschlossen — fuer ALLE Fragenden, auch Owner und Moderation —,
 * damit die Antwort sie gar nicht erst zitiert.
 *
 * Chunks tragen den Typ nicht. Der Ausschluss laeuft deshalb ueber die
 * `fileId`s der Webseiten: eine Lese-Abfrage je Frage, die Liste bleibt
 * klein (eine Library hat eine Handvoll Seiten, anders als Entwuerfe).
 *
 * Gilt fuer die Frage-Wege (Stream, einfache Route, Bruecke, Golden-Set),
 * nicht fuer Galerie oder Dokument-Abruf.
 */

import { findWebsiteFileIds } from '@/lib/repositories/website-file-ids'

function istObjekt(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nurTexte(werte: unknown, woher: string): string[] {
  if (!Array.isArray(werte) || !werte.every((w): w is string => typeof w === 'string')) {
    throw new Error(`Webseiten-Ausschluss: fileId.${woher} ist keine Liste von Texten`)
  }
  return werte
}

/**
 * Nimmt die Webseiten aus einem `fileId`-Filter (rein, ohne Datenbank).
 * Ein vorhandener Einschluss (`$in`, einzelner Wert) wird um die Webseiten
 * gekuerzt, ein vorhandener Ausschluss (`$nin`) erweitert. Jede andere Form
 * wirft — kein stilles Ueberschreiben (no-silent-fallbacks).
 */
export function fileIdFilterOhneWebseiten(vorhanden: unknown, webseiten: string[]): unknown {
  if (webseiten.length === 0) return vorhanden
  const raus = new Set(webseiten)
  if (vorhanden === undefined || vorhanden === null) return { $nin: webseiten }
  if (typeof vorhanden === 'string') return raus.has(vorhanden) ? { $in: [] } : vorhanden
  if (Array.isArray(vorhanden)) return { $in: nurTexte(vorhanden, 'Liste').filter((id) => !raus.has(id)) }
  if (istObjekt(vorhanden)) {
    const keys = Object.keys(vorhanden)
    if (keys.length === 1 && keys[0] === '$in') {
      return { $in: nurTexte(vorhanden.$in, '$in').filter((id) => !raus.has(id)) }
    }
    if (keys.length === 1 && keys[0] === '$nin') {
      return { $nin: [...new Set([...nurTexte(vorhanden.$nin, '$nin'), ...webseiten])] }
    }
  }
  throw new Error(`Webseiten-Ausschluss: unbekannte Form des fileId-Filters (${JSON.stringify(vorhanden)})`)
}

/**
 * Schliesst die erzeugten Webseiten der Library aus einem Chunk-/Summary-Filter
 * aus. Der Filter wird IN-PLACE veraendert und zurueckgegeben (wie
 * `applyDraftExclusionToChunkFilter`).
 */
export async function applyWebsiteExclusionToChunkFilter(
  filter: Record<string, unknown>,
  libraryKey: string,
  libraryId: string,
): Promise<Record<string, unknown>> {
  const webseiten = await findWebsiteFileIds(libraryKey, libraryId)
  if (webseiten.length === 0) return filter
  filter.fileId = fileIdFilterOhneWebseiten(filter.fileId, webseiten)
  return filter
}
