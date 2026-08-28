/**
 * @fileoverview Schreibschutz auf Pfadmustern (ST2, verfeinert in ST5).
 *
 * @description
 * Antwort auf die offene Frage §6 der Anforderungen („Wer darf schreiben?"):
 * Wenn die Storage-Schicht generisch schreiben kann, kann ein Agent an
 * `stand_setzen` vorbei den `bearbeitungsstand` aendern — und die
 * Schutzstufen, die dort haengen, greifen dann nicht.
 *
 * Statt eines zweiten Rechtemodells neben Clerk: eine kleine, ausdrueckliche
 * Liste von Pfadmustern, die dem Fachwerkzeug gehoeren. Der Fehler NENNT das
 * zustaendige Werkzeug — ein blosses „verboten" wuerde den Agenten nur zum
 * Suchen schicken.
 *
 * **Verfeinerung ST5 (Cowork-Befund 28.08.2026).** Die erste Fassung sperrte
 * die `_INDEX.md` fuer ALLES. Damit war sie breiter als ihr Zweck:
 *
 * - Ein neuer Ordner konnte seinen Contract nie bekommen (`datei_anlegen`
 *   verweigerte, `stand_setzen` legt nie an, `ordner_erstellen` legt nur den
 *   Ordner). Ordnerarbeit stand.
 * - Der Fliesstext einer bestehenden `_INDEX.md` war nicht korrigierbar.
 *
 * Geschuetzt gehoert der FELDKERN, nicht die Datei. Deshalb entscheidet jetzt
 * die {@link Aktion} mit: Frontmatter und Voll-Ersatz bleiben gesperrt,
 * Fliesstext und Anlegen sind frei.
 *
 * @module mcp/storage
 */

/**
 * Was mit dem Pfad geschehen soll. Die Sperre haengt nicht nur am Pfad —
 * eine `_INDEX.md` anzulegen ist erlaubt, ihr Frontmatter zu ueberschreiben
 * nicht.
 */
export type Aktion =
  /** Ganze Datei ersetzen (`datei_schreiben`) — trifft auch das Frontmatter. */
  | 'ganz_ersetzen'
  /** Frontmatter-Felder setzen (`datei_patchen` mit frontmatter_setzen). */
  | 'frontmatter'
  /** Nur Fliesstext (`datei_patchen` mit ersetze/abschnitt_ersetzen). */
  | 'fliesstext'
  /** Neu anlegen (`datei_anlegen`) — nur, wenn es die Datei noch nicht gibt. */
  | 'anlegen'
  | 'loeschen'
  /** Etwas AN diese Stelle verschieben (`verschieben`, Zielpfad). */
  | 'verschieben_ziel'

/** Aktionen, die den Feldkern einer `_INDEX.md` treffen wuerden. */
const INDEX_GESPERRT: readonly Aktion[] = ['ganz_ersetzen', 'frontmatter', 'loeschen', 'verschieben_ziel']

export interface SchutzRegel {
  trifft: (pfad: string, aktion: Aktion) => boolean
  stattdessen: string
  grund: string
}

const REGELN: readonly SchutzRegel[] = [
  {
    trifft: (pfad, aktion) => letztesSegment(pfad) === '_INDEX.md' && INDEX_GESPERRT.includes(aktion),
    stattdessen: 'stand_setzen (Bearbeitungsstand) bzw. themen_setzen (Themen). ' +
      'Fliesstext aendern geht mit datei_patchen (ersetze / abschnitt_ersetzen), ' +
      'eine fehlende _INDEX.md anlegen mit datei_anlegen.',
    grund:
      'Die _INDEX.md traegt den erklaerten Bearbeitungsstand. Wer ihr Frontmatter generisch ' +
      'schreibt oder sie ganz ersetzt, umgeht die Schutzstufen (Report veraltet, Stand weicht ab) ' +
      'und den Riegel gegen konkurrierende Schreiber.',
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

/** Der geschuetzte Pfad wurde fuer eine gesperrte Aktion adressiert. */
export class SchreibschutzError extends Error {
  readonly code = 'nicht_unterstuetzt' as const
  constructor(pfad: string, regel: SchutzRegel) {
    super(
      `"${pfad}" ist fuer diese Aktion gesperrt. ${regel.grund} ` +
      `Stattdessen: ${regel.stattdessen}`,
    )
    this.name = 'SchreibschutzError'
  }
}

/**
 * Wirft, wenn Pfad UND Aktion einem Fachwerkzeug gehoeren.
 *
 * Bewusst als Wurf und nicht als stiller Skip: Ein uebergangener
 * Schreibvorgang saehe fuer den Agenten aus wie ein erfolgter.
 */
export function pruefeSchreibschutz(pfad: string, aktion: Aktion): void {
  for (const regel of REGELN) {
    if (regel.trifft(pfad, aktion)) throw new SchreibschutzError(pfad, regel)
  }
}

/** Nur zur Anzeige in `speicher_info`/Fehlermeldungen. */
export function geschuetzteMuster(): string[] {
  return [
    '**/_INDEX.md (Frontmatter + Voll-Ersatz + Loeschen + Verschiebe-Ziel; Fliesstext und Anlegen frei)',
    '**/_*/** (Twin-Artefakte, vollstaendig)',
  ]
}
