/**
 * @fileoverview Was ein Sichten-Lauf ins Register schreibt (Register, Welle R1). Reine Funktionen.
 *
 * @description
 * `sichten_regenerieren` (Sicht `sitzungen`) und `sitzungen_block_schreiben`
 * sehen alle Belege mit Notiz ohnehin. Sie legen fehlende Zeilen an
 * (`gemeldetVon: archiv`, W3), schreiben den Ablage-Cache (W7), ergaenzen
 * `belegSourceIds` und stempeln `berichtet.chronikAm` bzw. `.blockAm` (W4) —
 * nur fuer Belege, die der Lauf wirklich berichtet hat. Die Zuordnung zum
 * Vorhaben ist die von S1 (`ordneSitzungenZu`), nicht eine zweite Regel.
 *
 * @module agent-view/sitzungen-register
 */

import { ordneIstZu } from './ist-zuordnen'
import type { IstBeleg, SitzungsAblage, SitzungsBerichtet, SitzungsRegisterDoc } from './types'

export type AbgleichArt = 'chronik' | 'block'

/** Ablage eines Belegs, wie S1 sie bestimmt hat (Ausschnitt aus `SitzungsDatensatz`). */
export interface BelegAblage {
  vorhabenPfad: string | null
  vorhabenFolderId: string | null
  belegOrdnerPfad: string | null
}

export interface AbgleichAenderung {
  registerId: string
  /** Zeitpunkt des Laufs (geaendertAm). */
  am: string
  /** Neuer Ablage-Cache; fehlt = unveraendert. */
  ablage?: SitzungsAblage
  /** Einzelner Stempel — als `berichtet.<feld>` geschrieben, damit Chronik- und Block-Lauf sich nicht ueberschreiben. */
  stempel?: { feld: 'chronikAm' | 'blockAm'; am: string }
  neueBelegSourceIds: string[]
}

export interface AbgleichPlan {
  neu: SitzungsRegisterDoc[]
  aenderungen: AbgleichAenderung[]
  hinweise: string[]
}

export function planeAbgleich(args: {
  libraryId: string
  docs: readonly SitzungsRegisterDoc[]
  belege: readonly IstBeleg[]
  /** sourceId → Ablage aus der S1-Zuordnung dieses Laufs. */
  ablagen: ReadonlyMap<string, BelegAblage>
  /** sourceIds, die dieser Lauf berichtet hat (Chronik geschrieben bzw. Block im Hauptvorhaben). */
  berichtet: ReadonlySet<string>
  /**
   * false im Teilbaum-Lauf: Dort rechnet der Scan Pfade ab dem Scope, nicht
   * ab der Library-Wurzel — die Ablage bliebe mit falschem Pfad stehen. Dann
   * nur Stempel und sourceIds; die Ablage schreibt der naechste volle Lauf.
   */
  ablageSchreiben: boolean
  art: AbgleichArt
  jetzt: string
}): AbgleichPlan {
  const plan: AbgleichPlan = { neu: [], aenderungen: [], hinweise: [] }
  const stempel: 'chronikAm' | 'blockAm' = args.art === 'chronik' ? 'chronikAm' : 'blockAm'
  for (const zeile of ordneIstZu({ libraryId: args.libraryId, docs: args.docs, belege: args.belege, jetzt: args.jetzt })) {
    if (zeile.belege.length === 0) continue
    const { doc } = zeile
    const mitAblage = zeile.belege.filter((b) => args.ablagen.has(b.sourceId))
    const erste = mitAblage[0] ? args.ablagen.get(mitAblage[0].sourceId) : undefined
    const ordner = new Set(mitAblage.map((b) => args.ablagen.get(b.sourceId)?.vorhabenFolderId ?? null))
    if (ordner.size > 1 && args.ablageSchreiben) {
      plan.hinweise.push(`${doc.registerId}: Teil-Belege liegen in verschiedenen Vorhaben — Ablage nach dem ersten (${erste?.vorhabenPfad ?? 'ohne Vorhaben'})`)
    }
    const neueAblage: SitzungsAblage | undefined = erste && args.ablageSchreiben ? { ...erste, geprueftAm: args.jetzt } : undefined
    const berichtetJetzt = zeile.belege.some((b) => args.berichtet.has(b.sourceId))
    const neueIds = zeile.belege.map((b) => b.sourceId).filter((id) => !doc.belegSourceIds.includes(id))

    if (!zeile.gespeichert) {
      const berichtet: SitzungsBerichtet = !berichtetJetzt ? doc.berichtet
        : stempel === 'chronikAm' ? { ...doc.berichtet, chronikAm: args.jetzt } : { ...doc.berichtet, blockAm: args.jetzt }
      plan.neu.push({ ...doc, ablage: neueAblage ?? doc.ablage, berichtet, belegSourceIds: [...doc.belegSourceIds, ...neueIds] })
      continue
    }
    if (neueAblage === undefined && !berichtetJetzt && neueIds.length === 0) continue
    plan.aenderungen.push({
      registerId: doc.registerId,
      am: args.jetzt,
      ...(neueAblage !== undefined ? { ablage: neueAblage } : {}),
      ...(berichtetJetzt ? { stempel: { feld: stempel, am: args.jetzt } } : {}),
      neueBelegSourceIds: neueIds,
    })
  }
  return plan
}

function spaeter(a: string | null, b: string | null): string | null {
  if (a === null) return b
  if (b === null) return a
  return a >= b ? a : b
}

/**
 * Fuehrt eine reine Archiv-Zeile in die Zeile, die gerade ihre Kennung
 * bekommt (Umschluesseln `alt:<Nr>` → Kennung). Von Hand Gepflegtes kommt
 * immer aus `ziel`; aus dem Archiv kommen Belege, Ablage und Stempel.
 */
export function zusammenfuehren(ziel: SitzungsRegisterDoc, archiv: SitzungsRegisterDoc): Partial<SitzungsRegisterDoc> {
  const ablage = ziel.ablage === null ? archiv.ablage
    : archiv.ablage === null ? ziel.ablage
      : ziel.ablage.geprueftAm >= archiv.ablage.geprueftAm ? ziel.ablage : archiv.ablage
  return {
    belegSourceIds: [...new Set([...ziel.belegSourceIds, ...archiv.belegSourceIds])],
    ablage,
    berichtet: {
      chronikAm: spaeter(ziel.berichtet.chronikAm, archiv.berichtet.chronikAm),
      blockAm: spaeter(ziel.berichtet.blockAm, archiv.berichtet.blockAm),
    },
    quelle: ziel.quelle ?? archiv.quelle,
    titelOriginal: ziel.titelOriginal ?? archiv.titelOriginal,
    beginn: ziel.beginn ?? archiv.beginn,
    ende: ziel.ende ?? archiv.ende,
    repo: ziel.repo ?? archiv.repo,
    branch: ziel.branch ?? archiv.branch,
  }
}
