/**
 * @fileoverview Adressen ueber Library-Grenzen (Wunschliste 8, Plan Abschnitt 6, G2) — pur.
 *
 * @description
 * Ein Mensch schreibt
 *
 * ```
 * [[@klima-archiv/Veranstaltungen/2026-09-25 Journalistenschulung/Flyer.pdf|Flyer]]
 * ```
 *
 * Das `@` sagt „andere Library", dahinter stehen der Slug (`slug.ts`) und der
 * Library-relative Pfad, optional ein Anker `#Abschnitt`. Dieselbe Form gilt
 * spaeter als URL `/@<slug>/<pfad>` und steht heute schon in den Antworten
 * der Bruecke (`quelle_suchen`, `moeglicherweiseIn`). Sie nennt nie eine
 * Instanz, nie eine Library-Id und nie eine Storage-Id — deshalb ueberlebt sie
 * den Umzug einer Library auf eine andere Instanz oder einen anderen Speicher.
 *
 * Aufgeloest wird die Adresse hier NICHT (das ist Schicht 3, reserviert);
 * dieses Modul zerlegt und baut nur, und es wirft mit Grund statt zu raten.
 *
 * @module library-adresse
 */

import { pruefeSlug } from './slug'

export interface LibraryAdresse {
  slug: string
  /** Library-relativer Pfad, ohne fuehrende/abschliessende Schraegstriche. */
  pfad: string
  /** Anker ohne `#`; null = keiner. */
  anker: string | null
}

/** Beginnt das (Verweis-)Ziel mit `@`? Dann ist es eine Library-Adresse. */
export function istLibraryAdresse(ziel: string): boolean {
  return ziel.trim().startsWith('@')
}

function normalisierePfad(pfad: string): string {
  const sauber = pfad.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/')
  if (sauber.split('/').some((segment) => segment === '..' || segment === '.')) {
    throw new Error(`Adresse mit "." oder ".." im Pfad: "${pfad}" — Adressen sind Library-relativ und absolut`)
  }
  return sauber
}

/** Zerlegt `@<slug>/<pfad>[#anker]`; wirft bei fehlendem `@`, ungueltigem Slug oder leerem Pfad. */
export function zerlegeAdresse(roh: string): LibraryAdresse {
  const text = roh.trim()
  if (!text.startsWith('@')) throw new Error(`Keine Library-Adresse (beginnt nicht mit @): "${roh}"`)
  const [ohneAnker, ...ankerTeile] = text.slice(1).split('#')
  const anker = ankerTeile.join('#').trim()
  const trenner = ohneAnker.indexOf('/')
  if (trenner === -1) throw new Error(`Adresse ohne Pfad: "${roh}" — erwartet @<slug>/<pfad>`)
  const slug = pruefeSlug(ohneAnker.slice(0, trenner))
  const pfad = normalisierePfad(ohneAnker.slice(trenner + 1))
  if (pfad === '') throw new Error(`Adresse ohne Pfad: "${roh}" — erwartet @<slug>/<pfad>`)
  return { slug, pfad, anker: anker === '' ? null : anker }
}

/** Baut die Adresse; Slug und Pfad werden geprueft wie beim Zerlegen. */
export function baueAdresse(args: { slug: string; pfad: string; anker?: string | null }): string {
  const slug = pruefeSlug(args.slug)
  const pfad = normalisierePfad(args.pfad)
  if (pfad === '') throw new Error('baueAdresse: leerer Pfad')
  const anker = args.anker?.trim()
  return `@${slug}/${pfad}${anker ? `#${anker}` : ''}`
}

/** Nur den Library-Teil als Kurzform `@<slug>` (z. B. wenn der Pfad unbekannt ist). */
export function baueBibliotheksKuerzel(slug: string): string {
  return `@${pruefeSlug(slug)}`
}
