/**
 * Erkennung von „Off-target-Datei-Flows" anhand der Flow-Schritte.
 *
 * Ein Wizard-Flow mit einem `selectSchemaType`-Schritt berechnet die hochgeladene
 * Datei OFF-TARGET im Schritt selbst (`computeFileMediaDraft` ueber die Inbox),
 * NICHT synchron ueber den Secretary (`/api/secretary/process-text`). Solche Flows
 * duerfen daher beim Hinzufuegen/Entfernen einer Quelle KEIN `runExtraction`
 * ausloesen.
 *
 * Hintergrund (Δ1): `process-text` erwartet ein **Schema-Template** (Frontmatter +
 * Systemprompt). Wuerde ein generischer Datei-Flow `runExtraction` aufrufen, wuerde
 * seine **Flow-ID** (z.B. `standard-capture`) faelschlich als Schema-Template-Name
 * geschickt — und scheitert mit „Template nicht gefunden", weil eine Flow-Entitaet
 * kein Schema ist.
 *
 * Bewusst FLOW-basiert statt hartkodierter Template-IDs: gilt fuer
 * `file-transcript-de` UND den generischen `standard-capture`-Flow gleichermassen
 * und deckt kuenftige Datei-Flows automatisch ab (kein silent fallback, kein
 * ID-Sonderfall-Wildwuchs).
 *
 * @param steps Flow-Schritte (nur `preset` wird gelesen).
 * @returns true, wenn der Flow die Datei im `selectSchemaType`-Schritt berechnet.
 */
export function flowComputesFileInSchemaTypeStep(
  steps: ReadonlyArray<{ preset: string }> | undefined | null,
): boolean {
  if (!steps) return false
  return steps.some((step) => step.preset === 'selectSchemaType')
}
