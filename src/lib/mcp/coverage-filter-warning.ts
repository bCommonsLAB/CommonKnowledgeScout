/**
 * @fileoverview Warnung fuer Pfad-Filter, die ins Leere greifen (Welle 5).
 *
 * @description
 * Pilot-Befund: `abdeckung_lesen` mit Pfad-Filter antwortete still mit
 * „0 Befunde", wenn der gespeicherte Report ein Teilbaum-Scan per `folderId`
 * war — dessen Pfade sind SCOPE-relativ, ein library-relativer Filter passt
 * dann auf nichts. Fuer den Agenten sieht das aus wie „Ordner ist sauber".
 * Diese Schicht benennt den Leerlauf ausdruecklich (`no-silent-fallbacks.mdc`).
 *
 * @module mcp
 */

export interface EmptyFilterArgs {
  /** Der vom Agenten angefragte (library-relative) Filter, normalisiert. */
  requestedPrefix: string
  /** true, wenn der Report ein Teilbaum-Report ist (scope.folderId gesetzt). */
  scoped: boolean
  /** Library-relativer Scope-Pfad des Reports; '' = unbekannt. */
  scopePath: string
  /** ECHTE Teilbaum-Treffer (ohne Vorfahren-Knoten wie die Wurzel). */
  matchedFolders: number
  matchedGaps: number
  reportGaps: number
}

/**
 * Klartext, wenn der Filter weder Ordner noch Befunde traf, der Report aber
 * Befunde enthaelt — sonst `null` (kein Leerlauf, oder Report ist wirklich leer).
 */
export function describeEmptyFilter(args: EmptyFilterArgs): string | null {
  if (args.requestedPrefix === '') return null
  if (args.matchedFolders > 0 || args.matchedGaps > 0) return null
  if (args.reportGaps === 0) return null

  const kern =
    `Der Pfad-Filter „${args.requestedPrefix}" traf NICHTS, obwohl der Report ` +
    `${args.reportGaps} Befund(e) enthaelt — das ist KEINE Entwarnung.`

  if (args.scoped && args.scopePath === '') {
    return (
      `${kern} Der gespeicherte Report ist ein TEILBAUM-Scan per folderId und kennt ` +
      'seinen library-relativen Pfad nicht; seine Pfade sind scope-relativ. Entweder ' +
      'den Filter weglassen bzw. scope-relativ angeben — oder mit abdeckung_scannen ' +
      'und dem Parameter „pfad" neu scannen, dann kennt der Report seinen Scope.'
    )
  }

  return (
    `${kern} Pfad pruefen: die Ordner dieses Reports liefert abdeckung_lesen ohne Filter ` +
    '(Feld „ordner").'
  )
}
