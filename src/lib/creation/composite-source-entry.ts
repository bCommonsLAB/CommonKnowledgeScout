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
  /**
   * Pfad der Quelle relativ zum Ordner der Sammeldatei (oder zur Library-
   * Wurzel), wenn der Eintrag Ordner-Segmente enthaelt — z. B.
   * `pdfs-pngs/musterkarten pdf/karte_rueck.pdf`. Ohne Ordner-Segmente undefined;
   * dann liegt die Quelle im selben Ordner wie die Sammeldatei.
   */
  relativePath?: string
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
 * - Ordner-Segmente VOR der Datei (`audios/karte.mp3`, `pdfs/karte.pdf/template`)
 *   sind ein Pfad relativ zur Sammeldatei: `relativePath` traegt ihn, `name` ist der
 *   Dateiname. Die Quelldatei ist das ERSTE Segment mit Dateiendung; ein Ordner mit
 *   Punkt im Namen vor der Datei wird deshalb nicht unterstuetzt (bewusste Grenze).
 */
export function parseCompositeSourceEntry(raw: string): ParsedCompositeSourceEntry {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { name: raw, raw }
  }

  if (!raw.includes('/')) {
    return { name: raw, raw }
  }

  const segments = raw.split('/')
  // Leere Teile (`/foo`, `bar/`, `a//b`) → unveraendert als Name, wie bisher.
  if (segments.some((seg) => seg.length === 0)) {
    return { name: raw, raw }
  }

  // Das erste Segment mit Dateiendung ist die Quelldatei; alles davor sind
  // Ordner, alles danach ist der Template-Suffix. Endet der Eintrag selbst auf
  // eine Dateiendung, ist er ein reiner Pfad ohne Template.
  const firstFileIndex = segments.findIndex(hasFileExtension)
  if (firstFileIndex < 0) {
    // Kein Segment mit Endung: altes Verhalten (Name bis zum ersten `/`).
    return { name: segments[0], templateName: segments.slice(1).join('/'), raw }
  }

  const pathSegments = segments.slice(0, firstFileIndex + 1)
  const templateSegments = segments.slice(firstFileIndex + 1)
  const entry: ParsedCompositeSourceEntry = {
    name: pathSegments[pathSegments.length - 1],
    raw,
  }
  if (pathSegments.length > 1) entry.relativePath = pathSegments.join('/')
  if (templateSegments.length > 0) entry.templateName = templateSegments.join('/')
  return entry
}

/** Dateiendung: Punkt plus 1–8 Buchstaben/Ziffern am Ende des Segments. */
function hasFileExtension(segment: string): boolean {
  return /\.[A-Za-z0-9]{1,8}$/.test(segment)
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
