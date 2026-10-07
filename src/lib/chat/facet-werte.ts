/**
 * Bedeutungs-Wörterbuch einer Facette (Plan `story-status-modalitaet`, m1).
 *
 * Eine Facette kann je Wert ein Klartext-Label, eine Bedeutung (geht als
 * Kontext an den Retriever) und eine Verbotsliste (Formulierungen, die bei
 * diesem Wert nicht in der Antwort stehen dürfen) tragen. Dazu das Flag
 * `ingestKontext`: ob die Facette als Klartext in den Metadaten-Vorspann der
 * Chunks und in den Dokument-Embedding-Text geschrieben wird.
 *
 * Diese Datei ist die EINE Quelle für Typ und Zod-Schema; `config.ts`
 * (Server-Normalisierung) und `use-chat-form.ts` (Settings-Formular) binden
 * sie ein, statt eigene Kopien zu führen. Pure Helper, keine Seiteneffekte.
 */

import * as z from 'zod'

/** Facetten-Typen, die ein Wörterbuch tragen dürfen (kategoriale Werte). */
export const WERTE_FAEHIGE_TYPEN: ReadonlySet<string> = new Set(['string', 'string[]'])

/** Ein Eintrag im Bedeutungs-Wörterbuch einer Facette. */
export interface FacetWert {
  /** Roher Wert, wie er in `docMetaJson.<metaKey>` steht (z. B. `nicht_umsetzbar`). */
  wert: string
  /** Klartext-Label für UI und Prompt (z. B. „nicht umsetzbar"). */
  label: string
  /** Bedeutung als Kontext für den Retriever (z. B. „als nicht umsetzbar bewertet; wird nicht umgesetzt"). */
  bedeutung?: string
  /** Formulierungen, die bei diesem Wert nicht in der Antwort stehen dürfen. */
  verboten?: string[]
}

export const facetWertSchema = z.object({
  wert: z.string().trim().min(1, 'Wert darf nicht leer sein'),
  label: z.string().trim().min(1, 'Label darf nicht leer sein'),
  bedeutung: z.string().trim().min(1).optional(),
  verboten: z.array(z.string().trim().min(1)).optional(),
})

/**
 * Wörterbuch einer Facette: Werte müssen eindeutig sein. Doppelte Werte wären
 * ein stiller Fehler (welche Bedeutung gilt?), deshalb hartes Zod-Issue.
 */
export const facetWerteSchema = z.array(facetWertSchema).superRefine((werte, ctx) => {
  const gesehen = new Set<string>()
  werte.forEach((w, index) => {
    if (gesehen.has(w.wert)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, 'wert'],
        message: `Wert „${w.wert}" ist im Wörterbuch doppelt`,
      })
    }
    gesehen.add(w.wert)
  })
})

/**
 * Prüft die Kombination Facetten-Typ × Wörterbuch. Ein Wörterbuch ergibt nur
 * für kategoriale Typen Sinn; bei Zahlen, Datum oder Bool ist es ein
 * Konfigurationsfehler, kein stilles Ignorieren. Für `superRefine` am
 * Facetten-Objekt gedacht (Server- und Formular-Schema teilen sich die Regel).
 */
export function pruefeWerteZuTyp(
  facet: { type?: string; werte?: unknown[] },
  ctx: z.RefinementCtx,
): void {
  if (!Array.isArray(facet.werte) || facet.werte.length === 0) return
  const typ = facet.type ?? 'string'
  if (!WERTE_FAEHIGE_TYPEN.has(typ)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['werte'],
      message: `Ein Bedeutungs-Wörterbuch ist nur für Typ string oder string[] erlaubt, nicht für „${typ}"`,
    })
  }
}

/** Findet den Wörterbuch-Eintrag zu einem rohen Wert; `undefined`, wenn keiner konfiguriert ist. */
export function findeFacetWert(
  werte: ReadonlyArray<FacetWert> | undefined,
  wert: unknown,
): FacetWert | undefined {
  if (!werte || typeof wert !== 'string') return undefined
  return werte.find((w) => w.wert === wert)
}
