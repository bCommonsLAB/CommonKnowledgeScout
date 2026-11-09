/**
 * @fileoverview Passt ein gespeicherter Cache-Hash noch zur aktuellen Konfiguration?
 *
 * @description
 * Der Cache-Hash eines Eintrags im Fragen-Log enthält Antwortregeln,
 * Facetten-Kontext und Dokumentzahl der Library ZUM ZEITPUNKT der Antwort.
 * Ändert sich eines davon, trifft keine neue Frage mehr diesen Eintrag — er
 * liegt dann nur noch in der Chronik. Die Verwaltungssicht „Fragen &
 * Antworten" zeigt das als „aktuell"/„veraltet": Hash aus den gespeicherten
 * `cacheParams` mit den HEUTIGEN Werten neu rechnen und vergleichen (Regel
 * in `cache-aktualitaet-regel.ts`). Hier der Prüfer je Library: Regeln und
 * Facetten-Kontext einmal auflösen, Dokumentzahl je Facetten-Auswahl zählen.
 *
 * @module chat
 */

import type { Library } from '@/types/library'
import type { NormalizedChatConfig } from '@/lib/chat/config'
import { parseFacetDefs } from '@/lib/chat/dynamic-facets'
import { loeseAntwortregelnAuf } from '@/lib/chat/antwortregeln'
import { facettenKontextFuerCache } from '@/lib/chat/quellen-kontext'
import { calculateDocumentCountForCache, normalizeFacetsSelectedForCache } from './cache-hash-builder'
import { aktualitaetAusParams, type CacheAktualitaet, type CacheEintrag } from './cache-aktualitaet-regel'

export { aktualitaetAusParams } from './cache-aktualitaet-regel'
export type { CacheAktualitaet, CacheEintrag, AktuellerCacheKontext } from './cache-aktualitaet-regel'

/** Schlüssel für die Dokumentzahl je Facetten-Auswahl (gleiche Auswahl = gleiche Zahl). */
function facettenSchluessel(facetsSelected: Record<string, unknown> | undefined): string {
  const n = normalizeFacetsSelectedForCache(facetsSelected)
  if (!n) return ''
  return JSON.stringify(Object.keys(n).sort().map((k) => [k, n[k]]))
}

export interface AktualitaetsPruefer {
  pruefe(eintrag: CacheEintrag): Promise<CacheAktualitaet>
  /** Gesetzt, wenn die Antwortregeln der Library nicht auflösbar sind — dann ist jeder Eintrag `unbekannt`. */
  hinweis: string | null
}

/**
 * Baut den Prüfer für eine Library: Antwortregeln und Facetten-Kontext einmal
 * auflösen, Dokumentzahl je Facetten-Auswahl einmal zählen. Kaputte
 * Antwortregeln (am Schema vorbei gespeichert) werden NICHT verschluckt,
 * sondern als `hinweis` gemeldet; die Liste bleibt lesbar.
 */
export function baueAktualitaetsPruefer(library: Library, chat: NormalizedChatConfig): AktualitaetsPruefer {
  const facetDefs = parseFacetDefs(library)
  const facettenKontext = facettenKontextFuerCache(facetDefs)
  let antwortregeln: string | undefined
  let hinweis: string | null = null
  try {
    antwortregeln = loeseAntwortregelnAuf(chat.antwortregeln, facetDefs)
  } catch (error) {
    hinweis = `Antwortregeln der Library nicht auflösbar: ${error instanceof Error ? error.message : String(error)}`
  }
  const zaehler = new Map<string, Promise<number>>()
  return {
    hinweis,
    async pruefe(eintrag) {
      if (hinweis !== null || !eintrag.cacheHash || !eintrag.cacheParams) return 'unbekannt'
      const schluessel = facettenSchluessel(eintrag.cacheParams.facetsSelected)
      let zahl = zaehler.get(schluessel)
      if (!zahl) {
        zahl = calculateDocumentCountForCache(library, eintrag.cacheParams.facetsSelected)
        zaehler.set(schluessel, zahl)
      }
      return aktualitaetAusParams(eintrag, { documentCount: await zahl, antwortregeln, facettenKontext })
    },
  }
}
