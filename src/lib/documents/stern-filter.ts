/**
 * stern-filter — `starred=<k>` und `sort=stars` serverseitig (ADR 0012).
 *
 * Bis Welle F1 filterte die Galerie „Mit Sternen" im Browser ueber die
 * geladene Seite: Treffer spaeterer Seiten fehlten, `total` stimmte nicht.
 * Jetzt liest der Server `starred=<k>` (mindestens k Sterne, k ganze Zahl
 * >= 1) und haengt eine fileId-Liste an den Basisfilter — in der Docs-,
 * Facetten- und Ids-Route gleich, damit Liste, `total` und Facetten-Zahlen
 * uebereinstimmen.
 *
 * Wer darf: Mitglieder immer; alle anderen nur, wenn die Library
 * `publicPublishing.starCountsPublic` gesetzt hat. Sonst 403 — kein stilles
 * Weglassen des Filters (no-silent-fallbacks.md). Ungueltiges k: 400.
 */

import { fileIdsMitMindestSternen } from '@/lib/repositories/source-user-states-count'

export interface SternFilterKontext {
  libraryId: string
  isMember: boolean
  starCountsPublic: boolean
}

export type SternFilterErgebnis =
  | { ok: true; fileIds: string[] | null }
  | { ok: false; status: 400 | 403; error: string }

export type StarredParam =
  | { ok: true; k: number | null }
  | { ok: false; status: 400; error: string }

/** Duerfen Sterne-Zahl, `sort=stars` und `starred` fuer diesen Aufruf genutzt werden? */
export function sterneSichtbar(isMember: boolean, starCountsPublic: boolean): boolean {
  return isMember || starCountsPublic === true
}

/**
 * Liest `starred` aus der Adresse. Fehlend oder leer = kein Filter (`k: null`).
 * `1` ist der Knopf „Im Fokus" (mindestens ein Stern); groessere Zahlen
 * heben die Schwelle an. Alles andere wird abgewiesen.
 */
export function parseStarred(raw: string | null): StarredParam {
  if (raw === null || raw.trim() === '') return { ok: true, k: null }
  const wert = raw.trim()
  if (!/^\d+$/.test(wert)) {
    return { ok: false, status: 400, error: `starred muss eine ganze Zahl >= 1 sein, bekommen: "${raw}"` }
  }
  const k = Number.parseInt(wert, 10)
  if (!Number.isInteger(k) || k < 1) {
    return { ok: false, status: 400, error: `starred muss eine ganze Zahl >= 1 sein, bekommen: "${raw}"` }
  }
  return { ok: true, k }
}

/**
 * Stern-Filter aus der Adresse: liefert die fileId-Liste (oder `null` ohne
 * Filter) bzw. den Fehler mit HTTP-Status. `laden` ist nur fuer Tests
 * austauschbar.
 */
export async function sternFilterAusQuery(
  url: URL,
  ctx: SternFilterKontext,
  laden: (libraryId: string, k: number) => Promise<string[]> = fileIdsMitMindestSternen,
): Promise<SternFilterErgebnis> {
  const param = parseStarred(url.searchParams.get('starred'))
  if (!param.ok) return param
  if (param.k === null) return { ok: true, fileIds: null }
  if (!sterneSichtbar(ctx.isMember, ctx.starCountsPublic)) {
    return {
      ok: false,
      status: 403,
      error: 'Filter nach Sternen ist Mitgliedern vorbehalten (starCountsPublic ist fuer diese Library nicht gesetzt)',
    }
  }
  const fileIds = await laden(ctx.libraryId, param.k)
  return { ok: true, fileIds }
}

/**
 * Haengt die fileId-Liste per `$and` an einen Mongo-Filter — so bleibt ein
 * vorhandenes `$or` (Suche, Default-Typ) oder `fileId`-Fragment unangetastet.
 * Eine leere Liste ergibt bewusst keine Treffer (`$in: []`).
 */
export function sternFilterAnhaengen(filter: Record<string, unknown>, fileIds: string[] | null): void {
  if (fileIds === null) return
  const existing = Array.isArray(filter.$and) ? (filter.$and as unknown[]) : []
  filter.$and = [...existing, { fileId: { $in: fileIds } }]
}

/**
 * `sort=stars` fuer diesen Aufruf pruefen: erlaubt fuer Mitglieder und bei
 * aktivem Schalter; sonst 403 statt still anders zu sortieren.
 */
export function sortStarsPruefen(
  rawSort: string | null,
  ctx: Pick<SternFilterKontext, 'isMember' | 'starCountsPublic'>,
): { ok: true } | { ok: false; status: 403; error: string } {
  if (rawSort !== 'stars') return { ok: true }
  if (sterneSichtbar(ctx.isMember, ctx.starCountsPublic)) return { ok: true }
  return {
    ok: false,
    status: 403,
    error: 'Sortierung nach Sternen ist Mitgliedern vorbehalten (starCountsPublic ist fuer diese Library nicht gesetzt)',
  }
}
