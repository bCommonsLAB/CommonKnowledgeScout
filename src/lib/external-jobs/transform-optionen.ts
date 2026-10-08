/**
 * @fileoverview Lauf-Optionen der Transformation (P6) fuer programmatische Jobs (Welle B).
 *
 * @description
 * Die Pipeline-Route reicht `slidesAsTable` und `appendixInSearch` nur
 * durch, wenn der Client sie explizit als Boolean setzt — fehlt der Wert,
 * entscheidet sichtbar die Library-Voreinstellung bzw. die Vorlage bleibt
 * unveraendert (`template-slides-option.ts`, `ingest-appendix-decision.ts`).
 * Die Job-Bauer der Bruecke nutzen dieselbe Regel ueber diese eine Funktion.
 *
 * @module external-jobs
 */

export interface TransformOptionen {
  /** „Slides als Tabelle fuehren": false nimmt das Feld `slides` fuer diesen Lauf aus der Vorlage. */
  slidesAsTable?: boolean
  /** „Anhaenge als Text in die Suche": steuert den unsichtbaren Ingest-Anhang. */
  appendixInSearch?: boolean
}

/** Nur explizite Booleans landen im Job — wie in `api/pipeline/process`. */
export function transformParameter(optionen: TransformOptionen | undefined): Record<string, boolean> {
  return {
    ...(typeof optionen?.slidesAsTable === 'boolean' ? { slidesAsTable: optionen.slidesAsTable } : {}),
    ...(typeof optionen?.appendixInSearch === 'boolean' ? { appendixInSearch: optionen.appendixInSearch } : {}),
  }
}
