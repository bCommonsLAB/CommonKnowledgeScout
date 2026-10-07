/**
 * Deterministische Nachprüfung einer Antwort (Plan `story-status-modalitaet`, m4).
 *
 * Der Server kennt für jedes zitierte Dokument [n] die Facettenwerte und das
 * Bedeutungs-Wörterbuch (m1). Daraus entstehen ohne Modell:
 *
 * 1. eine Verteilung je Facette mit Wörterbuch (wie viele zitierte Dokumente
 *    welchen Wert tragen) und daraus eine Fußnote unter der Antwort —
 *    der einzige Hebel des Plans, der nie halluziniert;
 * 2. Verstöße: Formulierungen aus der Verbotsliste eines getroffenen Werts,
 *    die trotzdem in der Antwort stehen.
 *
 * Der Antworttext wird NICHT umgeschrieben (no-silent-fallbacks): Verstöße
 * werden gemeldet und protokolliert, die Fußnote wird angehängt. Pure Helper.
 */

import type { DokumentGruppe } from './common/zitatmarken'
import type { KontextFacette } from './quellen-kontext'
import { findeFacetWert } from './facet-werte'
import type { NachpruefungErgebnis, NachpruefungVerstoss, NachpruefungVerteilung } from '@/types/nachpruefung'

/** Wert einer Facette für ein Dokument: erste Textstelle, die das Feld trägt. */
function werteDesDokuments(gruppe: DokumentGruppe, metaKey: string): string[] {
  for (const s of gruppe.sources) {
    const v = s.metadata?.[metaKey]
    if (v === undefined || v === null) continue
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
    if (typeof v === 'string') return [v]
  }
  return []
}

function normalisiere(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Prüft die Antwort gegen die Facettenwerte der zitierten Dokumente.
 * `benutzt` leer heißt wie bei den Belegen: alle Dokumente.
 */
export function pruefeAntwort(
  answer: string,
  gruppen: ReadonlyArray<DokumentGruppe>,
  benutzt: ReadonlyArray<number>,
  facetDefs: ReadonlyArray<KontextFacette>,
): NachpruefungErgebnis {
  const nur = benutzt.length > 0 ? new Set(benutzt) : null
  const zitiert = gruppen.filter((g) => nur === null || nur.has(g.nummer))
  const antwortNorm = normalisiere(answer)
  const verteilung: NachpruefungVerteilung[] = []
  const verstoesse: NachpruefungVerstoss[] = []

  for (const facette of facetDefs) {
    if (!facette.werte || facette.werte.length === 0) continue
    const zaehler = new Map<string, number>()
    const verbotenTreffer = new Map<string, { wert: string; nummern: number[] }>()
    let dokumente = 0

    for (const gruppe of zitiert) {
      const werte = werteDesDokuments(gruppe, facette.metaKey)
      if (werte.length === 0) continue
      dokumente += 1
      for (const wert of werte) {
        zaehler.set(wert, (zaehler.get(wert) ?? 0) + 1)
        const eintrag = findeFacetWert(facette.werte, wert)
        for (const formulierung of eintrag?.verboten ?? []) {
          if (!antwortNorm.includes(normalisiere(formulierung))) continue
          const key = `${wert}\u0000${formulierung}`
          const bekannt = verbotenTreffer.get(key)
          if (bekannt) bekannt.nummern.push(gruppe.nummer)
          else verbotenTreffer.set(key, { wert, nummern: [gruppe.nummer] })
        }
      }
    }

    if (dokumente === 0) continue
    verteilung.push({
      metaKey: facette.metaKey,
      label: facette.label || facette.metaKey,
      dokumente,
      werte: [...zaehler.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([wert, anzahl]) => ({ wert, label: findeFacetWert(facette.werte, wert)?.label ?? wert, anzahl })),
    })
    for (const [key, treffer] of verbotenTreffer) {
      const formulierung = key.slice(key.indexOf('\u0000') + 1)
      verstoesse.push({
        metaKey: facette.metaKey,
        wert: treffer.wert,
        wertLabel: findeFacetWert(facette.werte, treffer.wert)?.label ?? treffer.wert,
        formulierung,
        nummern: treffer.nummern,
      })
    }
  }

  return { verteilung, verstoesse, geprueft: zitiert.map((g) => g.nummer) }
}

/** Gibt es etwas zu protokollieren? Ohne Facette mit Wörterbuch unter den Treffern: nein. */
export function hatBefund(ergebnis: NachpruefungErgebnis): boolean {
  return ergebnis.verteilung.length > 0 || ergebnis.verstoesse.length > 0
}

/**
 * Fußnote aus der Verteilung: je Facette eine Zeile `*Label: 2 × A, 1 × B*`.
 * Bewusst ohne Satz drumherum — die Labels tragen die Sprache der Library,
 * eine feste Formulierung müsste je Zielsprache gepflegt werden.
 */
export function fussnote(ergebnis: NachpruefungErgebnis): string | undefined {
  if (ergebnis.verteilung.length === 0) return undefined
  return ergebnis.verteilung
    .map((v) => `*${v.label}: ${v.werte.map((w) => `${w.anzahl} × ${w.label}`).join(', ')}*`)
    .join('\n')
}

/** Hängt die Fußnote unter die Antwort; ohne Verteilung bleibt die Antwort unverändert. */
export function fussnoteAnhaengen(answer: string, ergebnis: NachpruefungErgebnis): string {
  const note = fussnote(ergebnis)
  return note ? `${answer}\n\n---\n${note}` : answer
}
