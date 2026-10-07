/**
 * Deterministische Prüfung einer Golden-Set-Frage (Plan `story-status-modalitaet`, m0).
 *
 * Ohne Modell bewertbar, dieselbe Logik wie Hebel B (`nachpruefung.ts`):
 *
 * 1. zitierte Dokumente gegen `erwarteteDokumente` (über die Kennung, die der
 *    Läufer vorher zu fileIds aufgelöst hat);
 * 2. Pflicht-Labels (`werteGenannt`) im Antworttext — Label aus dem Wörterbuch,
 *    ohne Eintrag der Rohwert (sichtbar, nicht versteckt);
 * 3. Verbotslisten der getroffenen Werte gegen den Text (`pruefeAntwort`).
 *
 * Die Fußnote (m4) wird VOR der Prüfung entfernt — sie trägt die Labels und
 * würde Punkt 2 trivial erfüllen. Pure Helper, keine Seiteneffekte.
 */

import type { DokumentGruppe } from '@/lib/chat/common/zitatmarken'
import type { KontextFacette } from '@/lib/chat/quellen-kontext'
import { findeFacetWert } from '@/lib/chat/facet-werte'
import { fussnote, pruefeAntwort } from '@/lib/chat/nachpruefung'
import type { NachpruefungErgebnis, NachpruefungVerstoss, NachpruefungVerteilung } from '@/types/nachpruefung'
import type { GoldenSetFrage, GoldenSetFragetyp } from './schema'

export interface GoldenSetLabelPruefung {
  metaKey: string
  wert: string
  label: string
  genannt: boolean
}

export interface GoldenSetDeterministisch {
  dokumente: { erwartet: string[]; gefunden: string[]; fehlend: string[] }
  labels: GoldenSetLabelPruefung[]
  verteilung: NachpruefungVerteilung[]
  verstoesse: NachpruefungVerstoss[]
  dokumenteVollstaendig: boolean
  labelsGenannt: boolean
  keineVerstoesse: boolean
  bestanden: boolean
}

export interface GoldenSetFrageErgebnis {
  id: string
  typ: GoldenSetFragetyp
  frage: string
  antwort: string
  /** Zitierte Dokument-Nummern [n] (leer zitiert = alle, wie bei den Belegen). */
  zitiert: number[]
  deterministisch: GoldenSetDeterministisch
}

function normalisiere(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ')
}

/** Entfernt die m4-Fußnote, falls der Orchestrator sie angehängt hat. */
export function antwortOhneFussnote(answer: string, ergebnis: NachpruefungErgebnis | undefined): string {
  if (!ergebnis) return answer
  const note = fussnote(ergebnis)
  if (!note) return answer
  const suffix = `\n\n---\n${note}`
  return answer.endsWith(suffix) ? answer.slice(0, -suffix.length) : answer
}

export interface PruefeGoldenSetFrageParams {
  frage: GoldenSetFrage
  kennungFeld: string
  /** Kennung → fileId, vom Läufer aus den Meta-Dokumenten aufgelöst. */
  kennungZuFileId: ReadonlyMap<string, string>
  /** Antwort OHNE Fußnote (siehe `antwortOhneFussnote`). */
  antwort: string
  gruppen: ReadonlyArray<DokumentGruppe>
  benutzt: ReadonlyArray<number>
  facetDefs: ReadonlyArray<KontextFacette>
}

/**
 * Prüft eine Frage deterministisch. Eine Kennung ohne fileId ist ein Fehler
 * des Läufers (Auflösung fehlt), kein stilles „nicht gefunden".
 */
export function pruefeGoldenSetFrage(params: PruefeGoldenSetFrageParams): GoldenSetFrageErgebnis {
  const { frage, kennungFeld, kennungZuFileId, antwort, gruppen, benutzt, facetDefs } = params
  const nur = benutzt.length > 0 ? new Set(benutzt) : null
  const zitiert = gruppen.filter((g) => nur === null || nur.has(g.nummer))
  const zitierteFileIds = new Set(zitiert.map((g) => g.fileId))

  const erwartet = frage.erwarteteDokumente.map((dok) => dok[kennungFeld])
  const gefunden: string[] = []
  const fehlend: string[] = []
  for (const kennung of erwartet) {
    const fileId = kennungZuFileId.get(kennung)
    if (!fileId) throw new Error(`Kennung „${kennung}" (Frage „${frage.id}") wurde nicht zu einer fileId aufgelöst`)
    if (zitierteFileIds.has(fileId)) gefunden.push(kennung)
    else fehlend.push(kennung)
  }

  const antwortNorm = normalisiere(antwort)
  const byKey = new Map(facetDefs.map((f) => [f.metaKey, f]))
  const labels: GoldenSetLabelPruefung[] = []
  for (const [metaKey, werte] of Object.entries(frage.pflicht.werteGenannt ?? {})) {
    for (const wert of werte) {
      const label = findeFacetWert(byKey.get(metaKey)?.werte, wert)?.label ?? wert
      labels.push({ metaKey, wert, label, genannt: antwortNorm.includes(normalisiere(label)) })
    }
  }

  const nachpruefung = pruefeAntwort(antwort, gruppen, benutzt, facetDefs)
  const dokumenteVollstaendig = fehlend.length === 0
  const labelsGenannt = labels.every((l) => l.genannt)
  const keineVerstoesse = nachpruefung.verstoesse.length === 0

  return {
    id: frage.id,
    typ: frage.typ,
    frage: frage.frage,
    antwort,
    zitiert: zitiert.map((g) => g.nummer),
    deterministisch: {
      dokumente: { erwartet, gefunden, fehlend },
      labels,
      verteilung: nachpruefung.verteilung,
      verstoesse: nachpruefung.verstoesse,
      dokumenteVollstaendig,
      labelsGenannt,
      keineVerstoesse,
      bestanden: dokumenteVollstaendig && labelsGenannt && keineVerstoesse,
    },
  }
}
