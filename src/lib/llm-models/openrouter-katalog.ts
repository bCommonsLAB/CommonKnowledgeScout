/**
 * @fileoverview OpenRouter-Modellkatalog (oeffentlich, ohne Schluessel).
 *
 * @description
 * Der Secretary reicht den Modellnamen unveraendert an OpenRouter weiter
 * (Befund 20.11.2026, `transformer_routes.py` /chat). Darum ist der
 * OpenRouter-Katalog die Quelle fuer „welche Modelle gibt es": Suche im
 * Dialog „Modell hinzufuegen" und Preise in der Tabelle. Ob ein Modell
 * wirklich ueber den Secretary laeuft, zeigt erst die Probe.
 *
 * Abruf ist oeffentlich und enthaelt keine Nutzerdaten; das Ergebnis bleibt
 * eine Stunde im Speicher des Prozesses.
 *
 * @module llm-models
 */

import type { KatalogEintrag } from '@/types/sprachmodell'

const KATALOG_URL = 'https://openrouter.ai/api/v1/models'
const HALTBAR_MS = 60 * 60 * 1000
const TIMEOUT_MS = 15_000

let zwischenspeicher: { geladenAm: number; eintraege: KatalogEintrag[] } | null = null

interface RohModell {
  id?: unknown
  name?: unknown
  context_length?: unknown
  pricing?: { prompt?: unknown; completion?: unknown }
}

/** Preis je Token (Text) → USD je 1 Mio. Token; negativ/leer = kein fester Preis. */
function preisProMio(wert: unknown): number | null {
  const zahl = typeof wert === 'string' || typeof wert === 'number' ? Number(wert) : Number.NaN
  if (!Number.isFinite(zahl) || zahl < 0) return null
  return Math.round(zahl * 1e6 * 1000) / 1000
}

/** Wandelt die Katalog-Antwort in Eintraege; wirft bei fremder Form. */
export function parseKatalog(roh: unknown): KatalogEintrag[] {
  const daten = (roh as { data?: unknown } | null)?.data
  if (!Array.isArray(daten)) throw new Error('OpenRouter-Katalog: Antwort ohne data-Liste')
  const eintraege: KatalogEintrag[] = []
  for (const m of daten as RohModell[]) {
    if (typeof m?.id !== 'string' || m.id.length === 0) continue
    eintraege.push({
      modelId: m.id,
      name: typeof m.name === 'string' && m.name.trim() ? m.name.trim() : m.id,
      kontext: typeof m.context_length === 'number' ? m.context_length : null,
      preisEin: preisProMio(m.pricing?.prompt),
      preisAus: preisProMio(m.pricing?.completion),
    })
  }
  return eintraege
}

/**
 * Batch-Varianten (`…:batch`) beantworten keine Live-Anfrage — die Probe ueber
 * den Secretary endet mit OpenRouter 404 (Befund 20.11.2026). Sie taugen nicht
 * fuer Chat und Story und erscheinen darum nicht in der Suche.
 */
export function istLiveModell(modelId: string): boolean {
  return !modelId.endsWith(':batch')
}

/** Sucht in Kennung und Name (alle Woerter muessen vorkommen); vorhandene Eintraege fallen weg. */
export function sucheImKatalog(
  eintraege: readonly KatalogEintrag[],
  frage: string,
  ausgenommen: ReadonlySet<string>,
  max = 30,
): KatalogEintrag[] {
  const woerter = frage.toLowerCase().split(/\s+/).filter(Boolean)
  if (woerter.length === 0) return []
  return eintraege
    .filter((e) => istLiveModell(e.modelId))
    .filter((e) => !ausgenommen.has(e.modelId))
    .filter((e) => {
      const text = `${e.modelId} ${e.name}`.toLowerCase()
      return woerter.every((w) => text.includes(w))
    })
    .slice(0, max)
}

/** Laedt den Katalog (eine Stunde zwischengespeichert); wirft, wenn OpenRouter nicht antwortet. */
export async function ladeKatalog(): Promise<KatalogEintrag[]> {
  if (zwischenspeicher && Date.now() - zwischenspeicher.geladenAm < HALTBAR_MS) return zwischenspeicher.eintraege
  const antwort = await fetch(KATALOG_URL, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' })
  if (!antwort.ok) throw new Error(`OpenRouter-Katalog nicht erreichbar (HTTP ${antwort.status})`)
  const eintraege = parseKatalog(await antwort.json())
  zwischenspeicher = { geladenAm: Date.now(), eintraege }
  return eintraege
}
