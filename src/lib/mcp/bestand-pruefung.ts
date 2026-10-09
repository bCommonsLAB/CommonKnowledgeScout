/**
 * @fileoverview Pruefregeln von `bestand_pruefen` (Welle A): reine Funktionen.
 *
 * @description
 * Vier Regeln, abgeleitet aus dem Live-Test 07./08.10.2026: doppelte Kennung
 * (29 Doppelgaenger nach einem Batch), Werte ausserhalb des
 * Bedeutungs-Woerterbuchs einer Facette (Freitext statt Schluessel), fehlende
 * Pflichtfelder des Typs, Eintraege aus Twin- (`_…`) oder Testordnern.
 * Gemeldet wird, nicht bereinigt — der Mensch entscheidet.
 *
 * @module mcp
 */

import { getTopLevelValue, type FacetDef } from '@/lib/chat/dynamic-facets'

export type PruefRegel = 'doppelte_kennung' | 'wert_ausserhalb_woerterbuch' | 'pflichtfeld_fehlt' | 'twin_oder_testordner'

export interface BestandEintrag {
  sourceId: string
  quelle: string
  detailViewType: string | null
  felder: Record<string, unknown>
  /** Library-relativer Pfad des Quellordners; null = nicht aufloesbar. */
  pfad: string | null
}

export interface Befund {
  regel: PruefRegel
  sourceId: string
  quelle: string
  detail: string
}

export interface BestandPruefung {
  befunde: Befund[]
  zaehler: Record<PruefRegel, number>
  /** Regeln, die nicht liefen, mit Grund — keine stille Luecke. */
  uebersprungen: string[]
}

/** Twin-Ordner beginnen mit `_`; `test`-Ordner sind Spielwiese, kein Bestand. */
export function istTwinOderTestPfad(pfad: string): boolean {
  return pfad
    .split('/')
    .filter(Boolean)
    .some((segment) => segment.startsWith('_') || segment.toLocaleLowerCase('de') === 'test')
}

function leer(wert: unknown): boolean {
  if (wert === undefined || wert === null) return true
  if (typeof wert === 'string') return wert.trim() === ''
  if (Array.isArray(wert)) return wert.length === 0
  return false
}

function kennungAls(wert: unknown): string | null {
  if (typeof wert === 'number' && Number.isFinite(wert)) return String(wert)
  if (typeof wert === 'string' && wert.trim() !== '') return wert.trim()
  return null
}

function werteAlsListe(wert: unknown): string[] {
  if (Array.isArray(wert)) return wert.filter((v): v is string => typeof v === 'string')
  return typeof wert === 'string' ? [wert] : []
}

export function pruefeBestand(
  eintraege: readonly BestandEintrag[],
  args: {
    defs: readonly FacetDef[]
    kennungsfeld?: string
    standardTyp: string
    pflichtfelder: (typ: string) => string[]
  },
): BestandPruefung {
  const befunde: Befund[] = []
  const uebersprungen: string[] = []

  // 1. Doppelte Kennung — nur mit benanntem Feld; raten waere ein stiller Default.
  if (args.kennungsfeld) {
    const nachKennung = new Map<string, BestandEintrag[]>()
    for (const e of eintraege) {
      const kennung = kennungAls(e.felder[args.kennungsfeld])
      if (kennung === null) continue
      nachKennung.set(kennung, [...(nachKennung.get(kennung) ?? []), e])
    }
    // Befund T2 (Brueckentest 2.44): Ein Feld, das kein Eintrag traegt, ergab
    // „0 Dubletten" — ein Tippfehler sah aus wie ein sauberer Bestand.
    if (eintraege.length > 0 && nachKennung.size === 0) {
      uebersprungen.push(`doppelte_kennung: kein Eintrag traegt das Feld "${args.kennungsfeld}" — Tippfehler? Feldnamen stehen in dokumente_auflisten`)
    }
    for (const [kennung, gruppe] of nachKennung) {
      if (gruppe.length < 2) continue
      for (const e of gruppe) {
        befunde.push({
          regel: 'doppelte_kennung', sourceId: e.sourceId, quelle: e.quelle,
          detail: `${args.kennungsfeld} = ${kennung} kommt ${gruppe.length}-mal vor (auch: ${gruppe.filter((g) => g !== e).map((g) => g.quelle).join(', ')})`,
        })
      }
    }
  } else {
    uebersprungen.push('doppelte_kennung: kein kennungsfeld angegeben (z. B. massnahme_nr)')
  }

  // 2. Werte ausserhalb des Woerterbuchs — nur Facetten MIT Woerterbuch.
  const mitWoerterbuch = args.defs.filter((d) => Array.isArray(d.werte) && d.werte.length > 0)
  if (mitWoerterbuch.length === 0) uebersprungen.push('wert_ausserhalb_woerterbuch: keine Facette traegt ein Woerterbuch')
  for (const e of eintraege) {
    for (const def of mitWoerterbuch) {
      const erlaubt = new Set((def.werte ?? []).map((w) => w.wert))
      const fremd = werteAlsListe(getTopLevelValue(e.felder, def)).filter((w) => !erlaubt.has(w))
      if (fremd.length === 0) continue
      befunde.push({
        regel: 'wert_ausserhalb_woerterbuch', sourceId: e.sourceId, quelle: e.quelle,
        detail: `${def.metaKey}: "${fremd.join('", "')}" steht nicht im Woerterbuch (${[...erlaubt].join(', ')})`,
      })
    }
  }

  // 3. Pflichtfelder des Typs.
  for (const e of eintraege) {
    const typ = e.detailViewType ?? args.standardTyp
    const fehlt = args.pflichtfelder(typ).filter((feld) => leer(e.felder[feld]))
    if (fehlt.length === 0) continue
    befunde.push({
      regel: 'pflichtfeld_fehlt', sourceId: e.sourceId, quelle: e.quelle,
      detail: `Typ ${typ}: ${fehlt.join(', ')} fehlt`,
    })
  }

  // 4. Twin- oder Testordner.
  let ohnePfad = 0
  for (const e of eintraege) {
    if (e.pfad === null) { ohnePfad += 1; continue }
    if (!istTwinOderTestPfad(e.pfad)) continue
    befunde.push({
      regel: 'twin_oder_testordner', sourceId: e.sourceId, quelle: e.quelle,
      detail: `liegt unter "${e.pfad}" — Twin- oder Testordner, gehoert nicht in den Index`,
    })
  }
  if (ohnePfad > 0) uebersprungen.push(`twin_oder_testordner: ${ohnePfad} Eintrag/Eintraege ohne aufloesbaren Pfad (kein Twin in MongoDB oder Ordner nicht erreichbar)`)

  const zaehler: Record<PruefRegel, number> = {
    doppelte_kennung: 0, wert_ausserhalb_woerterbuch: 0, pflichtfeld_fehlt: 0, twin_oder_testordner: 0,
  }
  for (const b of befunde) zaehler[b.regel] += 1
  return { befunde, zaehler, uebersprungen }
}
