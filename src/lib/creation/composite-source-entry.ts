/**
 * @fileoverview Parser fuer einzelne Eintraege in `_source_files` eines Composite-Markdowns.
 *
 * Hintergrund: Standard-Eintraege sind reine Dateinamen (`seite1.pdf`).
 * Composite-Transformations erweitern das Schema um ein optionales Schraegstrich-
 * Suffix mit dem Template-Namen: `seite1.pdf/gaderform-bett-steckbrief`.
 *
 * Im Resolver wird der Eintrag in `{name, templateName?}` zerlegt:
 * - ohne Suffix → laden als `kind: 'transcript'` (wie bisher)
 * - mit Suffix → laden als `kind: 'transformation'` mit dem Suffix als
 *   `templateName` (Pflicht laut `shadow-twin-contracts.mdc`)
 *
 * Die Funktion ist bewusst trivial gehalten und in einer eigenen Datei,
 * damit sie ohne Server-Imports getestet werden kann.
 */

/** Geparster Eintrag aus `_source_files`. */
export interface ParsedCompositeSourceEntry {
  /** Dateiname der Quelle (vor dem ersten `/`), z.B. `seite1.pdf`. */
  name: string
  /**
   * Template-Name (nach dem ersten `/`), z.B. `gaderform-bett-steckbrief`.
   * Nur gesetzt, wenn der Original-Eintrag ein Schraegstrich-Suffix enthielt.
   */
  templateName?: string
  /** Original-Eintrag (mit Suffix), nuetzlich fuer Logging und Anzeige. */
  raw: string
}

/**
 * Zerlegt einen `_source_files`-Eintrag in Dateiname und optionalen Template-Suffix.
 *
 * Regeln:
 * - Kein Schraegstrich → reiner Dateiname, `templateName` undefined.
 * - Genau ein Schraegstrich, nicht-leere Teile → `name` + `templateName`.
 * - Mehrere Schraegstriche → wir splitten am ERSTEN, der Rest gehoert zum Template-Namen
 *   (Template-Namen koennen `/` enthalten, kommt selten vor, ist aber moeglich).
 * - Leere Teile (`/foo`, `bar/`) → wir betrachten den Eintrag als ungueltig fuer den
 *   Template-Suffix-Pfad und geben nur `name` (Original) zurueck. Der Resolver
 *   landet damit im Standard-Transcript-Pfad und meldet ggf. `unresolvedSources`.
 */
export function parseCompositeSourceEntry(raw: string): ParsedCompositeSourceEntry {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { name: raw, raw }
  }

  const slashIndex = raw.indexOf('/')
  if (slashIndex < 0) {
    return { name: raw, raw }
  }

  const namePart = raw.slice(0, slashIndex)
  const templatePart = raw.slice(slashIndex + 1)

  if (namePart.length === 0 || templatePart.length === 0) {
    return { name: raw, raw }
  }

  return { name: namePart, templateName: templatePart, raw }
}

/**
 * Haengt einen Template-Suffix an einen Quelldateinamen an, wenn `templateName`
 * gesetzt ist. Wird beim Erstellen einer Composite-Transformations-Datei verwendet,
 * um die `_source_files`-Eintraege und Wikilinks konsistent zu erzeugen.
 *
 * Rueckgabe: `name` wenn kein Template, sonst `name/templateName`.
 */
export function appendTemplateSuffix(name: string, templateName: string | undefined | null): string {
  if (!templateName) return name
  return `${name}/${templateName}`
}
