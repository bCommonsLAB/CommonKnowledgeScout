/**
 * Die Wege aus der Startseite hinaus (Plan `startseite-als-embed`, WE2).
 *
 * Jeder Weg — Kachel, Handlungsaufruf im Kopf, Link im Sektions-Markdown,
 * Fusszeile, Banner — fragt dieselbe Schnittstelle: Ziel hinein, Adresse und
 * optional ein Klick ohne Neuladen heraus. Die App baut sie aus ihren Modi
 * (`app-navigation.ts`), das Startseiten-Embed spaeter aus `hrefFor` (WE4).
 * So kennt kein Baustein mehr Router, Adresszeile oder die Explore-Adressen.
 *
 * `WebsiteZiel` hat dieselbe Form wie `KsZiel` in `@ks/embed` (WE0); das
 * Embed reicht seine Ziele ohne Uebersetzung durch.
 */

import { loeseKartenziel } from './kartenziel'
import type { BannerSort } from './banner'

/** Welche Liste die Galerie zeigt: nur mit Stern, Reihung. */
export interface WebsiteGalerieListe {
  nurMitStern?: boolean
  sortierung?: 'stars' | 'rating'
}

/** Ein Weg aus der Startseite hinaus (Plan 3.2). */
export type WebsiteZiel =
  | { art: 'galerie'; liste?: WebsiteGalerieListe }
  | { art: 'dokument'; slug: string; seitenzahl?: number; liste?: WebsiteGalerieListe }
  | { art: 'story'; frage?: string }
  | { art: 'seite'; seite: string }

/** Was ein Link tut: seine Adresse und optional der Wechsel ohne Neuladen beim normalen Klick. */
export interface WebsiteWeg {
  href: string
  ausfuehren?: () => void
}

/** Die Navigation-Schnittstelle aller Wege der Startseite. */
export interface WebsiteNavigation {
  /** Der Weg zu einem Ziel; `null` = die Container-Seite hat dafuer keine Adresse, das Element entfaellt. */
  weg(ziel: WebsiteZiel): WebsiteWeg | null
  /**
   * Eine relative Adresse, die nicht zum Vokabular gehoert (`/pfad`, `#anker`,
   * `?andere=…`): was daraus wird. Fehlt die Methode oder liefert sie `null`,
   * entfaellt der Link und es steht in der Konsole.
   */
  fremd?(href: string): string | null
}

/** Was der Autor in einen Link geschrieben hat (Kopf-CTA, Sektions-Markdown). */
export type AutorenLink =
  | { art: 'ziel'; ziel: WebsiteZiel }
  | { art: 'extern'; url: string }
  | { art: 'fremd'; href: string }

/** Absolute Adressen, die in jeder Container-Seite gleich funktionieren. */
const ABSOLUT = /^(https?:\/\/|mailto:|tel:)\S+$/i

/**
 * Liest ein Autoren-Link: das Vokabular der Kacheln (`?view=gallery`,
 * `?mode=story`, `?site=<seite>`), eine absolute Adresse oder etwas anderes.
 * Wirft nicht — anders als bei Kacheln entscheidet hier die Navigation, ob
 * eine fremde Adresse gilt (`WebsiteNavigation.fremd`).
 */
export function autorenLink(href: string): AutorenLink {
  const wert = href.trim()
  if (ABSOLUT.test(wert)) return { art: 'extern', url: wert }
  if (wert.startsWith('?')) {
    try {
      const ziel = loeseKartenziel(wert)
      if (ziel.art === 'galerie') return { art: 'ziel', ziel: { art: 'galerie' } }
      if (ziel.art === 'story') return { art: 'ziel', ziel: { art: 'story' } }
      if (ziel.art === 'seite') return { art: 'ziel', ziel: { art: 'seite', seite: ziel.slug } }
      return { art: 'extern', url: ziel.url }
    } catch {
      // Kein Ziel des Vokabulars (z. B. `?view=gallery&x=1`): eine fremde Adresse.
      return { art: 'fremd', href: wert }
    }
  }
  return { art: 'fremd', href: wert }
}

/** Die Liste hinter dem Banner: bei `stars` die Rangliste (nur mit Stern, die meisten zuerst). */
export function bannerListe(sort: BannerSort | undefined): WebsiteGalerieListe | undefined {
  return sort === 'stars' ? { nurMitStern: true, sortierung: 'stars' } : undefined
}

/** Die Liste als Parameter der KnowledgeScout-Adresse (`starred`, `sort`), wie `bannerGalerieParams`. */
export function listeAlsParameter(liste: WebsiteGalerieListe | undefined): Record<string, string> {
  const params: Record<string, string> = {}
  if (liste?.nurMitStern === true) params.starred = '1'
  if (liste?.sortierung !== undefined) params.sort = liste.sortierung
  return params
}

const gemeldet = new Set<string>()

/**
 * Ein Weg, den es nicht gibt, meldet sich einmal je Text in der Konsole
 * (Plan, Entscheid E: das Element entfaellt, kein stiller Wegfall).
 */
export function wegFehltMelden(text: string): void {
  if (gemeldet.has(text)) return
  gemeldet.add(text)
  console.warn(`[website] ${text}`)
}
