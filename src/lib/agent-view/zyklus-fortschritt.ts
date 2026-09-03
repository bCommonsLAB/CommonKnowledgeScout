/**
 * @fileoverview Wo steht dieses Vorhaben im Erschliessungszyklus — pur.
 *
 * @description
 * Der Zyklus hat vier Schritte mit festen Zustaendigkeiten
 * (`docs/concepts/erschliessungszyklus.md` §1): Sichten (KnowledgeScout),
 * Strukturieren und Berichten (Cowork), Abnehmen (Peter). Bisher stand diese
 * Ordnung nur im Papier und in den Befund-Chips — auf der Werkbank musste man
 * sich zusammenreimen, ob man gerade zurueck in eine Cowork-Sitzung muss oder
 * selbst dran ist (Rueckfrage 27.08.2026).
 *
 * Diese Datei rechnet aus den vorhandenen Zaehlern die Lage je Schritt:
 * wie viele Befunde offen sind (Quelle: `gapsByType` + `GAP_REGISTRY`, also
 * die UNGEKAPPTE Summe der Karte) und welcher Schritt als naechster dran ist.
 * Fehler-Markierungen zaehlen zu Schritt 4 — sie loest der Mensch auf.
 *
 * Der erklaerte `bearbeitungsstand` wird NICHT verrechnet, sondern daneben
 * gestellt: Er ist eine Selbstauskunft, die Befunde sind die Messung. Wo
 * beides auseinanderfaellt, ist genau der Befund „Stand passt nicht zum
 * Inhalt" zustaendig — kein zweites Urteil an dieser Stelle.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import { GAP_REGISTRY } from './gap-registry'
import type { Bearbeitungsstand, CoverageGapType, GapCountByType, ZyklusSchritt } from './types'

export const ZYKLUS_SCHRITTE: readonly ZyklusSchritt[] = [1, 2, 3, 4]

/**
 * Befund-Typen aus abgeschafften Regeln: Sie stehen in gespeicherten Reports,
 * sind aber keine Aufgabe mehr (ADR 0006). Sie werden weder gezaehlt noch in
 * einen Auftrag geschrieben — und beim naechsten Scan sind sie weg.
 */
const ALT_BEFUNDE: readonly CoverageGapType[] = ['twin_unverified']

export function istAltBefund(typ: CoverageGapType): boolean {
  return ALT_BEFUNDE.includes(typ)
}

/**
 * Zyklus-Schritt eines Befunds — IMMER aus der Registry, nie aus dem im
 * Report gespeicherten Feld. Beides kann auseinanderfallen (der Report
 * konserviert die Regel seines Scans); dann zaehlte die Leiste anders als
 * der Auftrag sie einsammelt (Befund 27.08.2026: Schritt 3 zeigte „1",
 * lieferte aber zwei Aufgaben). Eine Quelle, kein Drift.
 */
export function schrittVon(gap: { type: CoverageGapType }): ZyklusSchritt {
  const definition = GAP_REGISTRY[gap.type]
  if (!definition) throw new Error(`Unbekannter Gap-Typ im Report: ${String(gap.type)}`)
  return definition.zyklusSchritt
}

/** Wer den Schritt ausfuehrt — feste Ordnung aus dem Zyklus-Papier §1. */
export const SCHRITT_ZUSTAENDIG: Record<ZyklusSchritt, string> = {
  1: 'KnowledgeScout',
  2: 'Cowork',
  3: 'Cowork',
  4: 'du',
}

/** Womit gearbeitet wird — beantwortet „wo mache ich das?". */
export const SCHRITT_WERKZEUG: Record<ZyklusSchritt, string> = {
  1: 'Pipeline in KnowledgeScout',
  2: 'Cowork-Sitzung am Dateisystem',
  3: 'Cowork-Sitzung am Dateisystem',
  4: 'hier in der Werkbank',
}

/**
 * Welchen Schritt ein Stand als ERLEDIGT behauptet. `ungesichtet` behauptet
 * nichts (0), `abgenommen` alle vier.
 */
const STAND_ERLEDIGT_BIS: Record<Bearbeitungsstand, number> = {
  ungesichtet: 0,
  erschlossen: 1,
  strukturiert: 2,
  berichtet: 3,
  abgenommen: 4,
}

export interface SchrittLage {
  schritt: ZyklusSchritt
  /** Offene Befunde, die diesem Schritt zugeordnet sind. */
  offen: number
  /** Der Stand behauptet, dieser Schritt sei erledigt. */
  behauptetErledigt: boolean
  /** Der naechste Schritt mit offenen Punkten — hier steht die Arbeit. */
  istDran: boolean
}

export interface ZyklusFortschritt {
  schritte: SchrittLage[]
  /** Erster Schritt mit offenen Punkten; null = nichts offen. */
  dran: ZyklusSchritt | null
  /** Summe aller offenen Punkte im Zyklus. */
  offenGesamt: number
}

/**
 * Lage je Schritt aus den Zaehlern der Karte.
 *
 * `markierungen` kommt aus den effektiven Familien (frische Markierungen sind
 * im gespeicherten Report noch nicht enthalten) und wird Schritt 4
 * zugeschlagen, ohne den gleichnamigen Befundtyp doppelt zu zaehlen.
 * `korrekturen` funktioniert genauso, geht aber auf Schritt 1.
 */
export function berechneZyklusFortschritt(args: {
  gapsByType: GapCountByType
  bearbeitungsstand: Bearbeitungsstand | null
  markierungen: number
  /**
   * Familien mit offenem Korrekturauftrag (K3), aus den effektiven Familien —
   * wie `markierungen`, damit ein frisch diktierter Auftrag sofort in der
   * Leiste steht und nicht erst nach dem naechsten Scan.
   */
  korrekturen: number
}): ZyklusFortschritt {
  const proSchritt: Record<ZyklusSchritt, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }

  for (const [typ, anzahl] of Object.entries(args.gapsByType)) {
    const definition = GAP_REGISTRY[typ as CoverageGapType]
    if (!definition) {
      throw new Error(`Unbekannter Gap-Typ im Report: ${typ}`)
    }
    // `twin_flagged` kommt ueber `markierungen` herein (frischer Stand),
    // damit dieselbe Markierung nicht zweimal zaehlt.
    if (typ === 'twin_flagged') continue
    // Dasselbe fuer `korrektur_offen` (K3): ein eben diktierter Auftrag steht
    // noch in keinem Report — er kommt ueber `korrekturen` herein.
    if (typ === 'korrektur_offen') continue
    // Alt-Bestand zaehlt nicht mit: Ohne diese Zeile blaeht er Schritt 4 auf
    // (im Pruefarchiv 28 Phantom-Punkte) und die Leiste behauptet Arbeit,
    // die niemand mehr tun soll.
    if (istAltBefund(typ as CoverageGapType)) continue
    proSchritt[definition.zyklusSchritt] += anzahl ?? 0
  }
  proSchritt[4] += args.markierungen
  // Schritt 1: Ein Auftrag loest fast immer Umbenennen/Verschieben aus, und
  // das gehoert laut Konventionen vor die Erschliessung (Registry-Eintrag).
  proSchritt[1] += args.korrekturen

  const erledigtBis = args.bearbeitungsstand === null ? 0 : STAND_ERLEDIGT_BIS[args.bearbeitungsstand]
  const dran = ZYKLUS_SCHRITTE.find((schritt) => proSchritt[schritt] > 0) ?? null

  return {
    schritte: ZYKLUS_SCHRITTE.map((schritt) => ({
      schritt,
      offen: proSchritt[schritt],
      behauptetErledigt: schritt <= erledigtBis,
      istDran: schritt === dran,
    })),
    dran,
    offenGesamt: ZYKLUS_SCHRITTE.reduce((summe, schritt) => summe + proSchritt[schritt], 0),
  }
}
