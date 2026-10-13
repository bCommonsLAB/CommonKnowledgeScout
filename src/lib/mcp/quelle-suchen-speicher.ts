/**
 * @fileoverview `quelle_suchen`: Treffer im Speicher aufloesen und Kennungen nachrechnen (W8-2).
 *
 * @description
 * Die Suche selbst laeuft in MongoDB (`quelle-suche-lauf.ts`). Hier kommen
 * die Storage-Zugriffe dazu, je Library ueber ihren eigenen Provider:
 *
 * - `loeseTrefferAuf`: Pfad (`getPathById`), Groesse und „liegt sie da?" fuer
 *   die ersten {@link MAX_AUFGELOEST} Treffer; mit der Groesse aus dem
 *   Speicher wird neu bewertet (aus `name` kann `name_groesse` oder belegt
 *   `verschieden` werden). Jeder Treffer traegt die Adresse `@<slug>/<pfad>`.
 * - `rechneNach`: liest bis zu {@link MAX_NACHRECHNEN} Treffer ohne Kennung
 *   (je bis 50 MB), rechnet die Quellkennung und schreibt sie ans
 *   Twin-Dokument — der einzige Weg, Altbestand ohne Migrationslauf zu
 *   versorgen (Plan W8-1).
 *
 * Fehler treffen EINEN Treffer und stehen in seiner Zeile, nie im Ganzen.
 *
 * @module mcp
 */

import { baueAdresse } from '@/lib/library-adresse/adresse'
import { setzeQuellkennung } from '@/lib/repositories/shadow-twin-repo'
import { bewerteTreffer, type Suchmerkmale, type Uebereinstimmung } from '@/lib/shadow-twin/quelle-suche'
import type { QuellTreffer } from '@/lib/shadow-twin/quelle-suche-lauf'
import { quellkennungAusBlob } from '@/lib/shadow-twin/quellkennung'
import type { StorageProvider } from '@/lib/storage/types'
import { normalisiere } from './storage/adressierung'
import { requireProvider } from './tool-shared'

export const MAX_AUFGELOEST = 20
export const MAX_NACHRECHNEN = 5
export const MAX_NACHRECHNEN_BYTES = 50 * 1024 * 1024

export interface TrefferZeile {
  libraryId: string
  libraryName: string
  slug: string | null
  /** `@<slug>/<pfad>`; null = Pfad unbekannt oder Library ohne gueltigen Slug. */
  adresse: string | null
  pfad: string | null
  sourceId: string
  sourceName: string
  /** true = liegt im Speicher, false = Twin ohne Datei, null = nicht geprueft. */
  imSpeicher: boolean | null
  groesse: number | null
  sourceContentHash: string | null
  erschliessung: { transkript: boolean; transformationen: number } | null
  uebereinstimmung: Uebereinstimmung
  grund?: string
}

export interface VerschiedenZeile {
  libraryId: string
  libraryName: string
  sourceId: string
  sourceName: string
  grund: string
}

export type ProviderJeLibrary = (libraryId: string) => Promise<StorageProvider>

/** Ein Provider je Library und Aufruf (nicht je Treffer). */
export function providerJeLibrary(userEmail: string): ProviderJeLibrary {
  const cache = new Map<string, Promise<StorageProvider>>()
  return (libraryId) => {
    const vorhanden = cache.get(libraryId)
    if (vorhanden) return vorhanden
    const neu = requireProvider(userEmail, libraryId)
    cache.set(libraryId, neu)
    return neu
  }
}

function fehlertext(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function adresseOderNull(slug: string | null, pfad: string | null): string | null {
  if (slug === null || pfad === null || pfad === '') return null
  return baueAdresse({ slug, pfad })
}

export async function loeseTrefferAuf(args: {
  treffer: readonly QuellTreffer[]
  such: Suchmerkmale
  provider: ProviderJeLibrary
}): Promise<{ zeilen: TrefferZeile[]; verschieden: VerschiedenZeile[] }> {
  const zeilen: TrefferZeile[] = []
  const verschieden: VerschiedenZeile[] = []
  for (const [nr, t] of args.treffer.entries()) {
    const basis = {
      libraryId: t.libraryId, libraryName: t.libraryName, slug: t.slug, sourceId: t.sourceId, sourceName: t.sourceName,
      sourceContentHash: t.sourceContentHash, erschliessung: t.erschliessung ?? null, uebereinstimmung: t.uebereinstimmung,
    }
    if (nr >= MAX_AUFGELOEST) {
      zeilen.push({ ...basis, adresse: null, pfad: null, imSpeicher: null, groesse: t.sourceSize, grund: `im Speicher nicht geprueft (Grenze ${MAX_AUFGELOEST})` })
      continue
    }
    let provider: StorageProvider
    try {
      provider = await args.provider(t.libraryId)
    } catch (error) {
      zeilen.push({ ...basis, adresse: null, pfad: null, imSpeicher: null, groesse: t.sourceSize, grund: `Speicher nicht erreichbar: ${fehlertext(error)}` })
      continue
    }
    try {
      const item = await provider.getItemById(t.sourceId)
      const pfad = normalisiere(await provider.getPathById(t.sourceId))
      const groesse = t.sourceSize ?? (typeof item.metadata.size === 'number' ? item.metadata.size : null)
      const neu = bewerteTreffer(args.such, { sourceName: t.sourceName, sourceContentHash: t.sourceContentHash, sourceSize: groesse })
      if (neu.art === 'verschieden') {
        verschieden.push({ libraryId: t.libraryId, libraryName: t.libraryName, sourceId: t.sourceId, sourceName: t.sourceName, grund: neu.grund })
        continue
      }
      if (neu.art === 'kein_treffer') continue
      zeilen.push({ ...basis, uebereinstimmung: neu.art, adresse: adresseOderNull(t.slug, pfad), pfad, imSpeicher: true, groesse })
    } catch (error) {
      zeilen.push({ ...basis, adresse: null, pfad: null, imSpeicher: false, groesse: t.sourceSize, grund: `Twin ohne Datei im Speicher: ${fehlertext(error)}` })
    }
  }
  return { zeilen, verschieden }
}

/** Rechnet fuer bis zu MAX_NACHRECHNEN Treffer ohne Kennung die Quellkennung und schreibt sie. */
export async function rechneNach(args: {
  zeilen: readonly TrefferZeile[]
  such: Suchmerkmale
  provider: ProviderJeLibrary
}): Promise<{ zeilen: TrefferZeile[]; verschieden: VerschiedenZeile[]; nachgerechnet: Array<{ libraryName: string; sourceName: string; ergebnis: string }> }> {
  const zeilen: TrefferZeile[] = []
  const verschieden: VerschiedenZeile[] = []
  const nachgerechnet: Array<{ libraryName: string; sourceName: string; ergebnis: string }> = []
  let gerechnet = 0
  let uebrig = 0
  for (const zeile of args.zeilen) {
    if (zeile.imSpeicher !== true || zeile.sourceContentHash !== null) { zeilen.push(zeile); continue }
    if (gerechnet >= MAX_NACHRECHNEN) { uebrig += 1; zeilen.push(zeile); continue }
    if (zeile.groesse !== null && zeile.groesse > MAX_NACHRECHNEN_BYTES) {
      nachgerechnet.push({ libraryName: zeile.libraryName, sourceName: zeile.sourceName, ergebnis: 'uebersprungen: groesser als 50 MB' })
      zeilen.push(zeile)
      continue
    }
    gerechnet += 1
    try {
      const { blob } = await (await args.provider(zeile.libraryId)).getBinary(zeile.sourceId)
      const kennung = await quellkennungAusBlob(blob, new Date().toISOString())
      const { gesetzt } = await setzeQuellkennung({ libraryId: zeile.libraryId, sourceId: zeile.sourceId, quellkennung: kennung })
      nachgerechnet.push({ libraryName: zeile.libraryName, sourceName: zeile.sourceName, ergebnis: gesetzt ? 'Kennung gesetzt' : 'Kennung gerechnet, Twin-Dokument fehlt' })
      const neu = bewerteTreffer(args.such, { sourceName: zeile.sourceName, sourceContentHash: kennung.sourceContentHash, sourceSize: kennung.sourceSize })
      if (neu.art === 'verschieden') {
        verschieden.push({ libraryId: zeile.libraryId, libraryName: zeile.libraryName, sourceId: zeile.sourceId, sourceName: zeile.sourceName, grund: neu.grund })
        continue
      }
      zeilen.push({
        ...zeile, sourceContentHash: kennung.sourceContentHash, groesse: kennung.sourceSize,
        uebereinstimmung: neu.art === 'kein_treffer' ? zeile.uebereinstimmung : neu.art,
      })
    } catch (error) {
      nachgerechnet.push({ libraryName: zeile.libraryName, sourceName: zeile.sourceName, ergebnis: `fehlgeschlagen: ${fehlertext(error)}` })
      zeilen.push(zeile)
    }
  }
  if (uebrig > 0) nachgerechnet.push({ libraryName: '(mehrere)', sourceName: '', ergebnis: `${uebrig} weitere ohne Kennung nicht nachgerechnet (Grenze ${MAX_NACHRECHNEN})` })
  return { zeilen, verschieden, nachgerechnet }
}
