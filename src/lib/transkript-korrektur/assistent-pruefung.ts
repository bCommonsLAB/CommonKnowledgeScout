/**
 * @fileoverview Antwort des Korrektur-Assistenten pruefen — rein, client-tauglich.
 *
 * @description
 * Die KI liefert Vorschlaege; uebernommen wird nur, was sich am Text
 * festmachen laesst. Verworfen (mit Grund, nie still):
 * - Korrektur, deren `alt` nicht zeichengenau im genannten Satz steht,
 * - Sprecher mit Namen, der in keinem Begleitdokument vorkommt (ausser den
 *   Rollen „Publikum" und „Moderation"),
 * - Satznummern ausserhalb des Transkripts, doppelte Sprecherwechsel.
 *
 * @module transkript-korrektur
 */

import type { AssistentBegleittext, AssistentSatz } from './assistent-auftrag'

export interface KorrekturVorschlag {
  id: string
  satz: number
  alt: string
  neu: string
  grund: string
}

export interface SprecherVorschlag {
  id: string
  abSatz: number
  name: string
  rolle: string
  grund: string
}

export interface AssistentErgebnis {
  korrekturen: KorrekturVorschlag[]
  sprecher: SprecherVorschlag[]
  verworfen: string[]
}

export const ROLLEN_OHNE_NAMEN = new Set(['publikum', 'moderation'])

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}
function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}
function int(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) ? v : null
}

/** Name gilt als belegt, wenn sein Nachname (letztes Wort) in einem Begleittext steht. */
function nameBelegt(name: string, begleit: string): boolean {
  const teile = name.split(/\s+/).filter((t) => t.length > 1)
  const nachname = teile[teile.length - 1]
  return !!nachname && begleit.includes(nachname.toLowerCase())
}

/** Grossgeschriebene Woerter (Namen, Nomen) in `neu`, die in `alt` nicht vorkommen. */
function neueGrossWoerter(alt: string, neu: string): string[] {
  const woerter = (t: string) => t.split(/[^\p{L}\p{N}'’-]+/u).filter((w) => w.length > 2)
  const vorhanden = new Set(woerter(alt).map((w) => w.toLowerCase()))
  return woerter(neu).filter((w) => /^\p{Lu}/u.test(w) && !vorhanden.has(w.toLowerCase()))
}

export function pruefeAssistentAntwort(
  roh: unknown,
  saetze: readonly AssistentSatz[],
  begleittexte: readonly AssistentBegleittext[],
  /** Bekannte Namen der Library — belegen Namen wie ein Begleitdokument. */
  bekannteNamen: readonly string[] = [],
): AssistentErgebnis {
  const wurzel = obj(roh) ?? {}
  const text = new Map(saetze.map((s) => [s.index, s.text]))
  const begleit = [...begleittexte.map((b) => b.text), ...bekannteNamen].join('\n').toLowerCase()
  // Ein neues Wort ist belegt, wenn es in Begleitdokumenten, bekannten Namen oder sonstwo im Transkript steht.
  const beleg = `${begleit}\n${saetze.map((s) => s.text).join('\n').toLowerCase()}`
  const verworfen: string[] = []

  const korrekturen: KorrekturVorschlag[] = []
  for (const e of Array.isArray(wurzel.korrekturen) ? wurzel.korrekturen : []) {
    const k = obj(e)
    const satz = int(k?.satz)
    const alt = str(k?.alt)
    const neu = str(k?.neu)
    if (satz === null || !text.has(satz)) { verworfen.push(`Korrektur „${alt}": Satz ${String(k?.satz)} gibt es nicht`); continue }
    if (!alt || !neu || alt === neu) { verworfen.push(`Korrektur in Satz ${satz}: alt/neu leer oder gleich`); continue }
    if (!(text.get(satz) ?? '').includes(alt)) { verworfen.push(`Korrektur „${alt}": steht nicht woertlich in Satz ${satz}`); continue }
    const unbelegt = neueGrossWoerter(alt, neu).filter((w) => !beleg.includes(w.toLowerCase()))
    if (unbelegt.length > 0) { verworfen.push(`Korrektur „${alt}" → „${neu}": ${unbelegt.join(', ')} steht in keinem Begleitdokument (erfunden?)`); continue }
    korrekturen.push({ id: `k${satz}-${korrekturen.length}`, satz, alt, neu, grund: str(k?.grund) })
  }

  const sprecher: SprecherVorschlag[] = []
  let letzter = ''
  const roheSprecher = (Array.isArray(wurzel.sprecher) ? wurzel.sprecher : [])
    .map((e) => obj(e))
    .filter((e): e is Record<string, unknown> => !!e)
    .sort((a, b) => (int(a.ab_satz) ?? 0) - (int(b.ab_satz) ?? 0))
  for (const s of roheSprecher) {
    const abSatz = int(s.ab_satz)
    const name = str(s.name)
    if (abSatz === null || !text.has(abSatz)) { verworfen.push(`Sprecher „${name}": Satz ${String(s.ab_satz)} gibt es nicht`); continue }
    if (!name) { verworfen.push(`Sprecher ab Satz ${abSatz}: kein Name`); continue }
    const rolle = ROLLEN_OHNE_NAMEN.has(name.toLowerCase())
    if (!rolle && !nameBelegt(name, begleit)) { verworfen.push(`Sprecher „${name}" (ab Satz ${abSatz}): steht in keinem Begleitdokument`); continue }
    if (name === letzter) continue
    if (sprecher.some((x) => x.abSatz === abSatz)) { verworfen.push(`Sprecher „${name}": zweiter Wechsel an Satz ${abSatz}`); continue }
    sprecher.push({ id: `s${abSatz}`, abSatz, name, rolle: str(s.rolle), grund: str(s.grund) })
    letzter = name
  }
  return { korrekturen, sprecher, verworfen }
}

/** Satz mit angewendeter Korrektur (erstes Vorkommen) — fuer das sofortige Speichern. */
export function satzMitKorrektur(satzText: string, v: Pick<KorrekturVorschlag, 'alt' | 'neu'>): string {
  return satzText.replace(v.alt, () => v.neu)
}
