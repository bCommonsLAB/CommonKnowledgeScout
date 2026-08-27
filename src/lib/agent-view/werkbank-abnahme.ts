/**
 * @fileoverview Abnahme-Fluss der Werkbank (Welle A4) — pur.
 *
 * @description
 * ADR 0006 (Modell B): Die Sammelaktionen sind ersatzlos entfallen — es gibt
 * nichts massenhaft zu bestaetigen; genau ihre Existenz war das Symptom der
 * Zustimmungspflicht. Geblieben sind das Einspielen eines frisch kurierten
 * Artefakts in seine Familie und der Sprung — der zielt jetzt auf den
 * naechsten WIDERSTAND (Fehler-Markierung), nicht auf das naechste
 * Unbestaetigte.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import type { LeadingArtifactSummary, TwinFamilySummary } from './types'
import { familienPruefstand } from './werkbank-baum'

export type PruefbareArt = 'transkript' | 'zusammenfassung'

/** Familie mit frisch verifiziertem Artefakt (Kind der Kurations-Antwort). */
export function patchFamilie(
  familie: TwinFamilySummary,
  art: PruefbareArt,
  frisch: LeadingArtifactSummary,
): TwinFamilySummary {
  return { ...familie, [art]: frisch }
}

/**
 * Naechster WIDERSTAND nach `abSourceId` (ADR 0006) — vorwaerts in
 * Listen-Reihenfolge, am Ende von vorn; die Ausgangsfamilie zaehlt nicht.
 * null = kein markierter Fehler mehr im Teilbaum.
 */
export function naechsterWiderstand(
  familien: readonly TwinFamilySummary[],
  abSourceId: string,
): TwinFamilySummary | null {
  const start = familien.findIndex((familie) => familie.sourceId === abSourceId)
  const anzahl = familien.length
  for (let schritt = 1; schritt <= anzahl; schritt += 1) {
    const familie = familien[(start + schritt + anzahl) % anzahl]
    if (familie === undefined || familie.sourceId === abSourceId) continue
    if (familienPruefstand(familie) === 'markiert') return familie
  }
  return null
}

/** Ergebnis des Sprungs nach einer Kurations-Aktion (ADR 0006). */
export interface SprungErgebnis {
  /** Naechster Widerstand; null = kein markierter Fehler mehr. */
  naechste: TwinFamilySummary | null
  /** Der DIREKTE Ordner der Familie traegt keine Markierung mehr. */
  ordnerFertig: boolean
  /** Das Ziel liegt in einem anderen Ordner. */
  ordnerGewechselt: boolean
  /** Kein Widerstand mehr im Teilbaum — nur noch die Abnahme fehlt. */
  vorhabenFertig: boolean
}

/**
 * Rechnet den Sprung NACH einer Kurations-Aktion: `gepatcht` ersetzt seine
 * Familie in der Liste, dann gilt {@link naechsterWiderstand}. Der
 * Ordner-Blick zaehlt nur den DIREKTEN Ordner (`folderId`) — dort haengen
 * die Artefakt-Zeilen des Baums.
 *
 * Wer nur liest, loest keinen Sprung aus: Die Werkbank ruft das hier erst
 * nach einer Aktion (markieren, Markierung aufloesen, verifizieren).
 */
export function sprungNachVerifikation(
  familien: readonly TwinFamilySummary[],
  gepatcht: TwinFamilySummary,
): SprungErgebnis {
  const liste = familien.some((familie) => familie.sourceId === gepatcht.sourceId)
    ? familien.map((familie) => (familie.sourceId === gepatcht.sourceId ? gepatcht : familie))
    : [gepatcht]
  const naechste = naechsterWiderstand(liste, gepatcht.sourceId)
  const ordnerFertig = liste
    .filter((familie) => familie.folderId === gepatcht.folderId)
    .every((familie) => familienPruefstand(familie) !== 'markiert')
  return {
    naechste,
    ordnerFertig,
    ordnerGewechselt: naechste !== null && naechste.folderId !== gepatcht.folderId,
    vorhabenFertig: naechste === null && familienPruefstand(gepatcht) !== 'markiert',
  }
}

/** Ordnername einer Familie aus ihrem Pfad (vorletztes Segment). */
function ordnerNameVon(familie: TwinFamilySummary): string {
  const teile = familie.path.split('/')
  return teile.length >= 2 ? teile[teile.length - 2] : ''
}

/**
 * Hinweistext zum Sprung: am Vorhaben-Ende sagt die Werkbank, dass kein
 * Widerstand mehr offen ist; beim Ordnerwechsel, wohin es weitergeht.
 * null = gewoehnlicher Sprung, kein Hinweis noetig.
 */
export function sprungHinweis(
  ergebnis: SprungErgebnis,
  gepatcht: TwinFamilySummary,
): { titel: string; beschreibung: string } | null {
  if (ergebnis.vorhabenFertig) {
    return {
      titel: 'Kein Widerstand mehr offen',
      beschreibung: 'In diesem Vorhaben ist nichts mehr als fehlerhaft markiert — es wartet auf die Abnahme (Knopf oben).',
    }
  }
  if (ergebnis.ordnerFertig && ergebnis.ordnerGewechselt && ergebnis.naechste !== null) {
    const ordner = ordnerNameVon(gepatcht)
    return {
      titel: ordner === '' ? 'Ordner ohne Markierung' : `Ordner „${ordner}“ ist frei von Markierungen`,
      beschreibung: `Weiter mit „${ergebnis.naechste.sourceName}“ im naechsten Ordner mit einem markierten Fehler.`,
    }
  }
  return null
}
