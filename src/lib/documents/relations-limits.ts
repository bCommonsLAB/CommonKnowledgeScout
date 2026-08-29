/**
 * @fileoverview Geteilte Obergrenze fuer den Pro-Maßnahme-Beziehungslauf.
 *
 * @description
 * Single Source of Truth fuer das Limit, ab dem `scope='library'`
 * (N fokussierte LLM-Paesse in EINEM Job) nicht mehr laeuft. Wird sowohl
 * serverseitig (`phase-doc-relations.ts`, harte Guard) als auch clientseitig
 * (Recompute-Button, Anzeige/Disable) verwendet — damit UI und Backend nicht
 * auseinanderdriften.
 */
export const MAX_LIBRARY_FOCUS = 150

/**
 * Batch-Größe für „alle Beziehungen berechnen": Die Recompute-Route teilt den
 * (gefilterten oder vollen) Maßnahmen-Bestand in Batches dieser Größe auf und
 * legt je Batch EINEN Hintergrund-Job an. So funktioniert „für alle" unabhängig
 * von der Katalog-/Gruppengröße, jeder Job bleibt klein/robust, und Batches
 * schreiben additiv (replaceEdgesForSources) statt sich gegenseitig zu löschen.
 */
export const RELATIONS_BATCH_SIZE = 50

