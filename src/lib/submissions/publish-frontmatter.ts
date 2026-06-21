/**
 * @fileoverview Erzwingt System-Felder im Publikations-Frontmatter (Variante A).
 *
 * @description
 * Eine Submission fuehrt `docType` und `detailViewType` als validierte Top-Level-
 * Felder (Quelle der Wahrheit, siehe `submission-capture.ts`). Das Publikations-
 * Frontmatter entstand bisher aber NUR aus `submission.metadata`
 * (`promotion.ts` -> `createMarkdownWithFrontmatter`). Hardcodierte Template-Felder
 * wie `detailViewType: session` wurden bewusst aus dem LLM-Antwortschema entfernt
 * (siehe `docs/analysis/detailViewType-video-bug.md`) und fehlen darum in
 * `metadata`, waehrend Placeholder-Felder wie `docType` ueberleben. Genau diese
 * Asymmetrie fuehrte dazu, dass Events ohne `detailViewType` veroeffentlicht und
 * von der Galerie auf den Library-Default `book` zurueckgesetzt wurden.
 *
 * Diese reine Funktion mergt die Top-Level-System-Felder DETERMINISTISCH zurueck
 * ins Frontmatter (System-Felder gewinnen, kein stiller Fallback): die gerenderte
 * Detailansicht muss zum erfassten Typ passen. Deckt beide Erfassungs-Pfade ab
 * (Text/URL-Flow und Datei-/Analyse-Flow), da jede Publikation durch den Promote
 * laeuft.
 *
 * @module lib/submissions
 */

export interface PublishFrontmatterArgs {
  /** Erfasste/analysierte Schema-Felder (flach). */
  metadata: Record<string, unknown>
  /** Validierter Inhalts-Typ (Top-Level der Submission). */
  docType: string
  /** Validierter Renderer-Typ (Top-Level der Submission). */
  detailViewType: string
}

/**
 * Baut das finale Publikations-Frontmatter: alle erfassten Metadaten plus die
 * erzwungenen System-Felder. System-Felder ueberschreiben gleichnamige Werte aus
 * `metadata`, damit ein abweichender LLM-/Formularwert die Anzeige nicht bricht.
 */
export function buildPublishFrontmatter(args: PublishFrontmatterArgs): Record<string, unknown> {
  return {
    ...args.metadata,
    docType: args.docType,
    detailViewType: args.detailViewType,
  }
}
