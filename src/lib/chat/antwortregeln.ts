/**
 * Antwortregeln einer Library (Plan `story-status-modalitaet`, m2).
 *
 * Ein Markdown-Text pro Library, der dem Sprachmodell sagt, wie es über die
 * Inhalte sprechen darf (z. B. Status als Zuschreibung, nie als Behauptung).
 * Zwei Platzhalter binden ihn an das Facetten-Schema derselben Library:
 *
 *   {{facette:<metaKey>}}  → Label der Facette
 *   {{legende:<metaKey>}}  → Tabelle Wert → Label → Bedeutung (+ Verbotsliste)
 *                            aus dem Bedeutungs-Wörterbuch `werte`
 *
 * Platzhalter sind Vertrag: ein unbekannter Platzhalter, eine unbekannte
 * Facette oder eine Legende ohne Wörterbuch ist ein Fehler — beim Speichern
 * (Formular + Server-Schema) und zur Laufzeit. Nie stilles Leerlassen
 * (no-silent-fallbacks). Pure Helper, keine Seiteneffekte.
 */

import * as z from 'zod'
import type { FacetWert } from './facet-werte'

/** Minimale Sicht auf eine Facette, die die Regeln brauchen. */
export interface RegelFacette {
  metaKey: string
  label?: string
  werte?: FacetWert[]
}

/** Alles, was wie ein Platzhalter aussieht — auch fehlerhafte, damit sie gemeldet werden. */
const PLATZHALTER_ALLE = /\{\{([^{}]*)\}\}/g
/** Gültige Form: Art, Doppelpunkt, metaKey. */
const PLATZHALTER_GUELTIG = /^\s*(facette|legende)\s*:\s*([A-Za-z0-9_.-]+)\s*$/

export interface AntwortregelnFehler {
  platzhalter: string
  grund: string
}

/**
 * Prüft alle Platzhalter eines Regeltexts gegen das Facetten-Schema.
 * Liefert eine Fehlerliste; leer heißt gültig.
 */
export function pruefeAntwortregeln(
  text: string | undefined,
  facets: ReadonlyArray<RegelFacette>,
): AntwortregelnFehler[] {
  if (!text) return []
  const byKey = new Map(facets.map((f) => [f.metaKey, f]))
  const fehler: AntwortregelnFehler[] = []
  for (const treffer of text.matchAll(PLATZHALTER_ALLE)) {
    const roh = treffer[0]
    const inner = treffer[1]
    const m = PLATZHALTER_GUELTIG.exec(inner)
    if (!m) {
      fehler.push({ platzhalter: roh, grund: 'Erlaubt sind nur {{facette:<metaKey>}} und {{legende:<metaKey>}}' })
      continue
    }
    const art = m[1]
    const metaKey = m[2]
    const facette = byKey.get(metaKey)
    if (!facette) {
      fehler.push({ platzhalter: roh, grund: `Facette „${metaKey}" gibt es im Schema nicht` })
      continue
    }
    if (art === 'legende' && (!facette.werte || facette.werte.length === 0)) {
      fehler.push({ platzhalter: roh, grund: `Facette „${metaKey}" hat kein Bedeutungs-Wörterbuch (werte)` })
    }
  }
  return fehler
}

/** Fehlerliste als eine Zeile je Fehler, für Formular und Exceptions. */
export function formatiereAntwortregelnFehler(fehler: ReadonlyArray<AntwortregelnFehler>): string {
  return fehler.map((f) => `${f.platzhalter}: ${f.grund}`).join('\n')
}

/**
 * Zod-Refinement für Schemata, die `antwortregeln` UND `gallery.facets` tragen
 * (Server-`chatConfigSchema` und das Settings-Formular teilen sich die Regel).
 */
export function pruefeAntwortregelnZuFacetten(
  cfg: { antwortregeln?: string; gallery?: { facets?: RegelFacette[] } },
  ctx: z.RefinementCtx,
): void {
  const fehler = pruefeAntwortregeln(cfg.antwortregeln, cfg.gallery?.facets ?? [])
  for (const f of fehler) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['antwortregeln'], message: `${f.platzhalter}: ${f.grund}` })
  }
}

/** Markdown-Legende eines Wörterbuchs: ein Listenpunkt je Wert. */
export function legendeAlsMarkdown(facette: RegelFacette): string {
  const werte = facette.werte ?? []
  const zeilen = werte.map((w) => {
    const bedeutung = w.bedeutung ? `: ${w.bedeutung}` : ''
    const verboten = w.verboten && w.verboten.length > 0
      ? ` Nicht formulieren: ${w.verboten.map((v) => `„${v}"`).join(', ')}.`
      : ''
    return `- ${w.label} (\`${w.wert}\`)${bedeutung}${verboten}`
  })
  return zeilen.join('\n')
}

/**
 * Löst die Platzhalter auf. Wirft bei ungültigen Platzhaltern — zur Laufzeit
 * heißt das: die gespeicherte Konfiguration ist kaputt (am Schema vorbei
 * geschrieben), und das soll man sehen, nicht in einer stillen Lücke suchen.
 */
export function loeseAntwortregelnAuf(
  text: string | undefined,
  facets: ReadonlyArray<RegelFacette>,
): string | undefined {
  const getrimmt = text?.trim()
  if (!getrimmt) return undefined
  const fehler = pruefeAntwortregeln(getrimmt, facets)
  if (fehler.length > 0) {
    throw new Error(`Antwortregeln ungültig:\n${formatiereAntwortregelnFehler(fehler)}`)
  }
  const byKey = new Map(facets.map((f) => [f.metaKey, f]))
  return getrimmt.replace(PLATZHALTER_ALLE, (_roh, inner: string) => {
    const m = PLATZHALTER_GUELTIG.exec(inner)
    // Durch pruefeAntwortregeln garantiert gültig; der Guard hält TypeScript ruhig.
    if (!m) throw new Error(`Antwortregeln: Platzhalter nicht auflösbar: {{${inner}}}`)
    const facette = byKey.get(m[2])
    if (!facette) throw new Error(`Antwortregeln: Facette „${m[2]}" fehlt`)
    return m[1] === 'facette' ? (facette.label || facette.metaKey) : legendeAlsMarkdown(facette)
  })
}
