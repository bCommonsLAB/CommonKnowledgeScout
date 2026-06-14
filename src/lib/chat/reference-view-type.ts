/**
 * Anreicherung der Story-Verweise um den Inhaltstyp (Welle A4) — reine Logik.
 *
 * Trennt bewusst die DB-Beschaffung (Aufrufer) von der Abbildung (hier), damit
 * die Zuordnung fileId → detailViewType ohne MongoDB unit-testbar bleibt. Der
 * detailViewType erlaubt formatgerechte Verweise (z.B. „Klimamaßnahme") in der
 * Referenzliste — das formatgerechte OEFFNEN existiert bereits via Renderer.
 */

import type { ChatResponse } from '@/types/chat-response'

/** Minimale Sicht auf ein Meta-Dokument (nur das flache docMetaJson). */
export interface MetaDocLike {
  docMetaJson?: Record<string, unknown>
}

/**
 * Baut `fileId → detailViewType` aus Meta-Dokumenten (`docMetaJson.detailViewType`).
 * Leere/fehlende Werte ergeben `undefined` (kein Raten).
 */
export function buildViewTypeByFileId(
  metaByFileId: ReadonlyMap<string, MetaDocLike>
): Map<string, string | undefined> {
  const out = new Map<string, string | undefined>()
  for (const [fileId, doc] of metaByFileId) {
    const value = doc?.docMetaJson?.detailViewType
    out.set(fileId, typeof value === 'string' && value.trim() !== '' ? value : undefined)
  }
  return out
}

/**
 * Reichert Referenzen um den `detailViewType` ihres Dokuments an (rein, immutabel).
 * Referenzen ohne bekannten Typ bleiben unveraendert.
 */
export function attachViewTypeToReferences(
  references: ChatResponse['references'],
  viewTypeByFileId: ReadonlyMap<string, string | undefined>
): ChatResponse['references'] {
  return references.map((ref) => {
    const viewType = viewTypeByFileId.get(ref.fileId)
    return viewType ? { ...ref, detailViewType: viewType } : ref
  })
}
