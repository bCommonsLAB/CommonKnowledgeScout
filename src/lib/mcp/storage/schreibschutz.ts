/**
 * @fileoverview Schreibschutz auf Pfadmustern (Welle ST2).
 *
 * @description
 * Antwort auf die offene Frage §6 der Anforderungen („Wer darf schreiben?"):
 * Wenn die Storage-Schicht generisch schreiben kann, kann ein Agent an
 * `stand_setzen` vorbei den `bearbeitungsstand` aendern — und die
 * Schutzstufen, die dort haengen (Report veraltet, Stand im Storage weicht
 * ab, kein `_INDEX.md` vorhanden), greifen dann nicht.
 *
 * Statt eines zweiten Rechtemodells neben Clerk: eine kleine, ausdrueckliche
 * Liste von Pfadmustern, die dem Fachwerkzeug gehoeren. Der Fehler NENNT das
 * zustaendige Werkzeug — ein blosses „verboten" wuerde den Agenten nur zum
 * Suchen schicken.
 *
 * Bewusst KEINE Twin-Familien-Logik hier (Anforderungen §4): diese Schicht
 * weiss nur, dass ein Pfad geschuetzt ist, nicht warum fachlich.
 *
 * @module mcp/storage
 */

export interface SchutzRegel {
  /** Trifft auf den library-relativen Pfad zu. */
  trifft: (pfad: string) => boolean
  /** Was der Agent stattdessen benutzen soll. */
  stattdessen: string
  grund: string
}

const REGELN: readonly SchutzRegel[] = [
  {
    trifft: (pfad) => letztesSegment(pfad) === '_INDEX.md',
    stattdessen: 'stand_setzen (Bearbeitungsstand) bzw. themen_setzen (Themen)',
    grund:
      'Die _INDEX.md traegt den erklaerten Bearbeitungsstand. Wer sie generisch schreibt, ' +
      'umgeht die Schutzstufen (Report veraltet, Stand weicht ab) und den Riegel gegen ' +
      'konkurrierende Schreiber.',
  },
  {
    trifft: (pfad) => segmente(pfad).slice(0, -1).some((s) => s.startsWith('_')),
    stattdessen: 'twins_synchronisieren bzw. transformation_starten',
    grund:
      'Unterhalb eines "_"-Ordners liegen Twin-Artefakte. Sie werden erzeugt, nicht ' +
      'von Hand geschrieben — sonst divergieren Spiegel und MongoDB.',
  },
]

function segmente(pfad: string): string[] {
  return pfad.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
}

function letztesSegment(pfad: string): string {
  const teile = segmente(pfad)
  return teile[teile.length - 1] ?? ''
}

/** Der geschuetzte Pfad wurde zum Schreiben adressiert. */
export class SchreibschutzError extends Error {
  readonly code = 'nicht_unterstuetzt' as const
  constructor(pfad: string, regel: SchutzRegel) {
    super(
      `"${pfad}" ist fuer generisches Schreiben gesperrt. ${regel.grund} ` +
      `Stattdessen: ${regel.stattdessen}.`,
    )
    this.name = 'SchreibschutzError'
  }
}

/**
 * Wirft, wenn der Pfad einem Fachwerkzeug gehoert.
 *
 * Bewusst als Wurf und nicht als stiller Skip: Ein uebergangener
 * Schreibvorgang saehe fuer den Agenten aus wie ein erfolgter.
 */
export function pruefeSchreibschutz(pfad: string): void {
  for (const regel of REGELN) {
    if (regel.trifft(pfad)) throw new SchreibschutzError(pfad, regel)
  }
}

/** Nur zur Anzeige in `speicher_info`/Fehlermeldungen. */
export function geschuetzteMuster(): string[] {
  return ['**/_INDEX.md', '**/_*/**']
}
