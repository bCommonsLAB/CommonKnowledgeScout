/**
 * Das Ziel-Vokabular des Embeds als Adress-Parameter (Plan
 * `startseite-als-embed`, WE0).
 *
 * Ein Weg aus einer KnowledgeScout-Komponente hinaus ist ein Link der
 * Container-Anwendung: Sie entscheidet, welche ihrer Seiten das Ziel zeigt.
 * Was die Seite dort wissen muss (welches Dokument, welche Frage, welche
 * Liste), reist als Adress-Parameter. Die Namen sind die der
 * KnowledgeScout-Adresse mit Vorsatz `ks-` — die eigenen Parameter der
 * Container-Seite (z. B. ein eigenes `view`) bleiben so unberuehrt.
 *
 * Rein, ohne React: Die Container-Anwendung kann beides auch auf dem Server
 * aufrufen (Next-Seite mit `searchParams`).
 */

import type {
  KsAdressParameter,
  KsEinstieg,
  KsGalerieListe,
  KsZiel,
  ksEinstiegAusParametern as ErklaerungEinstieg,
  ksSeiteAusParametern as ErklaerungSeite,
  ksZielAlsParameter as ErklaerungZiel,
} from './typen'

/** Die Parameter-Namen: die der KnowledgeScout-Adresse mit Vorsatz `ks-`. */
export const KS_PARAMETER = {
  dokument: 'ks-doc',
  seitenzahl: 'ks-page',
  frage: 'ks-q',
  nurMitStern: 'ks-starred',
  sortierung: 'ks-sort',
  seite: 'ks-site',
} as const

export const SORTIERUNGEN: readonly NonNullable<KsGalerieListe['sortierung']>[] = ['stars', 'rating']

function istSortierung(wert: string): wert is NonNullable<KsGalerieListe['sortierung']> {
  return (SORTIERUNGEN as readonly string[]).includes(wert)
}

function nichtLeer(wert: unknown, was: string): string {
  if (typeof wert !== 'string' || wert.trim() === '') throw new Error(`${was} fehlt oder ist leer`)
  return wert.trim()
}

function listeEintragen(liste: KsGalerieListe | undefined, ziel: Record<string, string>): void {
  if (liste === undefined) return
  if (liste.nurMitStern === true) ziel[KS_PARAMETER.nurMitStern] = '1'
  if (liste.sortierung !== undefined) {
    if (!istSortierung(liste.sortierung)) {
      throw new Error(`Sortierung "${String(liste.sortierung)}" gibt es nicht — erlaubt: ${SORTIERUNGEN.join(', ')}`)
    }
    ziel[KS_PARAMETER.sortierung] = liste.sortierung
  }
}

export function ksZielAlsParameter(ziel: KsZiel): Record<string, string> {
  const p: Record<string, string> = {}
  switch (ziel.art) {
    case 'galerie':
      listeEintragen(ziel.liste, p)
      return p
    case 'dokument':
      p[KS_PARAMETER.dokument] = nichtLeer(ziel.slug, 'Ziel "dokument": slug')
      if (ziel.seitenzahl !== undefined) {
        if (!Number.isInteger(ziel.seitenzahl) || ziel.seitenzahl < 1) {
          throw new Error(`Ziel "dokument": seitenzahl "${String(ziel.seitenzahl)}" ist keine Seite (ab 1)`)
        }
        p[KS_PARAMETER.seitenzahl] = String(ziel.seitenzahl)
      }
      listeEintragen(ziel.liste, p)
      return p
    case 'story':
      if (ziel.frage !== undefined) p[KS_PARAMETER.frage] = nichtLeer(ziel.frage, 'Ziel "story": frage')
      return p
    case 'seite':
      p[KS_PARAMETER.seite] = nichtLeer(ziel.seite, 'Ziel "seite": seite')
      return p
    default: {
      const unbekannt: never = ziel
      throw new Error(`Unbekanntes Ziel: ${JSON.stringify(unbekannt)}`)
    }
  }
}

function melden(text: string): void {
  console.error(`[ksEinstiegAusParametern] ${text} — nicht uebernommen`)
}

/** Ein Parameter oder `undefined`; mehrere Werte sind ein Fehler. */
function lesen(params: KsAdressParameter, name: string): string | undefined {
  const werte = params instanceof URLSearchParams ? params.getAll(name) : ([] as string[]).concat(params[name] ?? [])
  if (werte.length > 1) {
    melden(`${name} steht ${werte.length}-mal in der Adresse`)
    return undefined
  }
  return werte[0]
}

/** Ein nicht leerer Wert oder `undefined` (leer wird gemeldet). */
function lesenNichtLeer(params: KsAdressParameter, name: string): string | undefined {
  const wert = lesen(params, name)
  if (wert === undefined) return undefined
  if (wert.trim() === '') {
    melden(`${name} ist leer`)
    return undefined
  }
  return wert.trim()
}

function listeLesen(params: KsAdressParameter): KsGalerieListe | undefined {
  const liste: KsGalerieListe = {}
  const stern = lesen(params, KS_PARAMETER.nurMitStern)
  if (stern === '1') liste.nurMitStern = true
  else if (stern !== undefined) melden(`${KS_PARAMETER.nurMitStern}="${stern}" — erlaubt ist nur 1`)
  const sortierung = lesen(params, KS_PARAMETER.sortierung)
  if (sortierung !== undefined) {
    if (istSortierung(sortierung)) liste.sortierung = sortierung
    else melden(`${KS_PARAMETER.sortierung}="${sortierung}" — erlaubt: ${SORTIERUNGEN.join(', ')}`)
  }
  return Object.keys(liste).length > 0 ? liste : undefined
}

export function ksEinstiegAusParametern(params: KsAdressParameter): KsEinstieg {
  const einstieg: KsEinstieg = {}
  const dokument = lesenNichtLeer(params, KS_PARAMETER.dokument)
  if (dokument !== undefined) einstieg.dokument = dokument

  const seitenzahl = lesen(params, KS_PARAMETER.seitenzahl)
  if (seitenzahl !== undefined) {
    const zahl = Number(seitenzahl)
    if (dokument === undefined) melden(`${KS_PARAMETER.seitenzahl} ohne ${KS_PARAMETER.dokument}`)
    else if (!Number.isInteger(zahl) || zahl < 1) melden(`${KS_PARAMETER.seitenzahl}="${seitenzahl}" ist keine Seite (ab 1)`)
    else einstieg.seitenzahl = zahl
  }

  const frage = lesenNichtLeer(params, KS_PARAMETER.frage)
  if (frage !== undefined) einstieg.frage = frage

  const liste = listeLesen(params)
  if (liste !== undefined) einstieg.liste = liste
  return einstieg
}

export function ksSeiteAusParametern(params: KsAdressParameter): string | undefined {
  return lesenNichtLeer(params, KS_PARAMETER.seite)
}

// Im Typecheck geprueft: Die Umsetzung passt zur oeffentlichen Erklaerung.
const passtZiel: typeof ErklaerungZiel = ksZielAlsParameter
const passtEinstieg: typeof ErklaerungEinstieg = ksEinstiegAusParametern
const passtSeite: typeof ErklaerungSeite = ksSeiteAusParametern
void passtZiel
void passtEinstieg
void passtSeite
