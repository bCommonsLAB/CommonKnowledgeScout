/**
 * @fileoverview Leer-Begruendungen der Werkbank-Liste (F6, Welle W3).
 *
 * @description
 * „Ein leerer Filter nennt immer den Grund" (Akzeptanzkriterium 4,
 * `describeEmptyFilter`-Muster der MCP-Bruecke): keine stumme leere Flaeche.
 * Die Begruendung benennt die aktiven Einschraenkungen, erklaert die
 * Vorhaben-Erkennung bei leerem Report und weist Karten aus Scans vor W1
 * sowie Teilbaum-Reports explizit aus.
 *
 * Reine Funktion, kein I/O.
 *
 * @module agent-view
 */

import { actorLabel, zyklusSchrittLabel } from './labels'
import type { BefundFilter, WerkbankStatusFilter } from './werkbank-filter'

const STATUS_LABEL: Record<WerkbankStatusFilter, string> = {
  alle: 'Alle',
  zu_tun: 'Zu tun',
  bereit: 'Bereit zur Abnahme',
  liste: 'Arbeitsliste',
}

export interface WerkbankLeerArgs {
  /** Zeilen NACH Filterung (leer ⇒ Begruendung noetig). */
  gefiltert: number
  /** Vorhaben im Report insgesamt. */
  gesamt: number
  statusFilter: WerkbankStatusFilter
  befundFilter: BefundFilter
  suche: string
  /** Karten aus Scans vor W1, deren „Zu tun" nicht auswertbar war. */
  nichtAuswertbar: number
  /** Teilbaum-Report? `scopePath` = Scope, wenn der Report ihn kennt. */
  scoped: boolean
  scopePath: string | null
  /** W6, nur bei `statusFilter: 'liste'`: Zustand der aktiven Arbeitsliste. */
  liste?: {
    /** null = keine Liste gewaehlt/vorhanden. */
    name: string | null
    mitglieder: number
    tote: number
  }
}

function aktiveEinschraenkungen(args: WerkbankLeerArgs): string[] {
  const teile: string[] = []
  if (args.statusFilter !== 'alle') teile.push(`Filter „${STATUS_LABEL[args.statusFilter]}"`)
  if (args.befundFilter.akteur !== null) teile.push(`Akteur ${actorLabel(args.befundFilter.akteur)}`)
  if (args.befundFilter.zyklusSchritt !== null) {
    teile.push(zyklusSchrittLabel(args.befundFilter.zyklusSchritt))
  }
  if (args.suche.trim() !== '') teile.push(`Suche „${args.suche.trim()}"`)
  return teile
}

/**
 * Begruendet eine leere Liste; `null`, wenn sie gar nicht leer ist.
 * Reihenfolge: leerer Report (mit/ohne Teilbaum-Scope) → nicht auswertbare
 * Alt-Karten → aktive Einschraenkungen → Spezialerklaerung je Status-Filter.
 */
export function beschreibeLeereWerkbankListe(args: WerkbankLeerArgs): string | null {
  if (args.gefiltert > 0) return null

  if (args.gesamt === 0) {
    const scopeHinweis = args.scoped
      ? ` Der Report ist ein TEILBAUM-Report${args.scopePath ? ` (Scope: ${args.scopePath})` : ''} — fuer die ganze Library neu scannen.`
      : ''
    return (
      'Kein Vorhaben im Report. Vorhaben sind Ordner mit `bearbeitungsstand` im `_INDEX.md` ' +
      `oder Ordner, die auf das Vorhaben-Muster der Library passen.${scopeHinweis}`
    )
  }

  if (args.statusFilter === 'liste') {
    const liste = args.liste
    if (!liste || liste.name === null) {
      return 'Keine Arbeitsliste gewaehlt — oben eine Liste waehlen oder eine neue anlegen.'
    }
    if (liste.mitglieder === 0) {
      return `Arbeitsliste „${liste.name}" ist leer — Vorhaben ueber den Pin oder „Zu Liste hinzufuegen" im Detail aufnehmen.`
    }
    if (liste.tote === liste.mitglieder) {
      return `Kein Mitglied von „${liste.name}" ist im letzten Scan — alle ${liste.tote} Eintraege stehen unten als „nicht im letzten Scan".`
    }
    // Mitglieder vorhanden, aber Suche/Chips filtern alles weg → unten weiter.
  }

  if (args.statusFilter === 'zu_tun' && args.nichtAuswertbar > 0) {
    return (
      `„Zu tun" ist fuer ${args.nichtAuswertbar} von ${args.gesamt} Vorhaben nicht auswertbar — ` +
      'der Report stammt aus einem Scan vor Werkbank-Welle W1 (keine Ampel je Karte). Neu scannen.'
    )
  }

  const teile = aktiveEinschraenkungen(args)
  if (args.statusFilter === 'zu_tun' && teile.length === 1) {
    return `Nichts zu tun: alle ${args.gesamt} Vorhaben sind gruen und ohne Widerspruch.`
  }
  if (args.statusFilter === 'bereit' && teile.length === 1) {
    return (
      `Kein Vorhaben ist bereit zur Abnahme (${args.gesamt} im Report) — ` +
      'bereit heisst: kein Widerstand offen (weder maschinelle Befunde noch ' +
      'Fehler-Markierungen) und noch nicht abgenommen.'
    )
  }
  // Kombination bzw. Suche/Chips allein: die aktiven Einschraenkungen benennen.
  return `Keines der ${args.gesamt} Vorhaben passt auf: ${teile.join(' · ')}.`
}
