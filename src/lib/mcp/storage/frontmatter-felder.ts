/**
 * @fileoverview Frontmatter-Felder setzen — zeilen-chirurgisch (Welle ST3).
 *
 * @description
 * `frontmatter_setzen` schreibt einzelne Felder, ohne den Body und ohne
 * fremde Frontmatter-Zeilen anzufassen.
 *
 * Warum NICHT `patchFrontmatter` (der Single-Serializer)? Weil er das
 * GESAMTE Frontmatter neu schreibt und dabei jeden String quotet
 * (`type: index` → `type: "index"`). Fuer maschinen-eigene Dateien ist das
 * richtig; fuer die von Hand gepflegten, Obsidian-kompatiblen Dateien im
 * Archiv ist es eine sichtbare Aenderung an Zeilen, die niemand angefasst
 * hat — der Test-Befund vom 24.08.2026, aus dem `stand-zeilen-patch.ts`
 * entstanden ist. Dieselbe Chirurgie wird hier wiederverwendet, statt eine
 * zweite danebenzustellen.
 *
 * Was die Chirurgie voraussetzt, garantiert `stand-zeilen-patch.ts` fuer
 * den Stand-Patch ueber ein geschlossenes Vokabular. Hier kommen die Werte
 * von einem Agenten — deshalb steht die Garantie hier als PRUEFUNG:
 *
 * 1. Keys sind flach und `snake_case` (AGENTS.md-Frontmatter-Regel) — keine
 *    Dot-Notation, keine verschachtelten Objekte.
 * 2. Werte sind Skalare und werden so formatiert, dass der Parser sie
 *    unveraendert zurueckliest (Symmetrie statt Handarbeit).
 * 3. Nach dem Patch wird mit dem ECHTEN Parser rueckgelesen und verglichen.
 *    Weicht ein Feld ab, bricht der Vorgang ab — geschrieben wird nichts.
 *
 * @module mcp/storage
 */

import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { patchStandZeilen } from '@/lib/agent-view/stand-zeilen-patch'
import { berechneErgaenzung } from './frontmatter-listen'

/** Was `frontmatter_setzen` als Wert annimmt. */
export type FeldWert = string | number | boolean

const KEY_MUSTER = /^[a-z][a-z0-9_]*$/
/** Genau die Formen, die `parseSecretaryMarkdownStrict` NICHT als String zurueckgibt. */
const ZAHL = /^[-+]?[0-9]+(\.[0-9]+)?$/

/**
 * Formatiert einen Wert so, dass der Parser ihn identisch zurueckliest.
 *
 * Plain, wo es gefahrlos ist — damit die Datei fuer einen Menschen (und
 * fuer Obsidian) unveraendert aussieht. Gequotet nur dort, wo der Parser
 * sonst etwas anderes daraus machen wuerde: `"123"` bliebe sonst nicht
 * String, ein fuehrendes Leerzeichen ginge verloren, ein Zeilenumbruch
 * zerrisse den Block.
 */
export function formatiereWert(wert: FeldWert): string {
  if (typeof wert === 'boolean') return String(wert)
  if (typeof wert === 'number') {
    if (!Number.isFinite(wert)) throw new Error(`Zahl ist nicht endlich: ${wert}`)
    return String(wert)
  }
  const brauchtQuotes =
    wert === '' ||
    wert !== wert.trim() ||
    /[\r\n]/.test(wert) ||
    wert === 'true' || wert === 'false' ||
    ZAHL.test(wert) ||
    wert.startsWith('"') || wert.startsWith("'") ||
    wert.startsWith('#') || wert.startsWith('[') || wert.startsWith('{') ||
    wert.startsWith('-') || wert.startsWith('&') || wert.startsWith('*') ||
    wert.startsWith('|') || wert.startsWith('>')
  return brauchtQuotes ? JSON.stringify(wert) : wert
}

/** Prueft Key und Wert gegen die Frontmatter-Regel; wirft mit Klartext. */
function pruefeFeld(key: string, wert: unknown): asserts wert is FeldWert {
  if (!KEY_MUSTER.test(key)) {
    throw new Error(
      `Ungueltiger Frontmatter-Key "${key}": erlaubt sind flache snake_case-Keys ` +
      '(Kleinbuchstaben, Ziffern, Unterstrich). Keine Dot-Notation ("a.b"), keine ' +
      'verschachtelten Objekte — das Frontmatter bleibt flach und Obsidian-kompatibel.',
    )
  }
  if (Array.isArray(wert) || (wert !== null && typeof wert === 'object')) {
    throw new Error(
      `Feld "${key}": Listen und Objekte werden hier NICHT geschrieben. Der Parser liest ` +
      'sie als Rohstring zurueck — geschrieben und gelesen waeren verschieden. Solche ' +
      'Felder gehoeren ueber datei_schreiben oder ein Fachwerkzeug gesetzt.',
    )
  }
  const typ = typeof wert
  if (typ !== 'string' && typ !== 'number' && typ !== 'boolean') {
    throw new Error(`Feld "${key}": nur Text, Zahl oder Wahrheitswert — war ${typ}`)
  }
}

/**
 * Setzt die genannten Felder im Frontmatter; Body und fremde Zeilen bleiben
 * Byte fuer Byte stehen.
 *
 * @throws wenn ein Key/Wert die Regel verletzt ODER die Rueckprobe zeigt,
 *   dass ein Feld nicht so ankommt, wie es gemeint war.
 */
export function setzeFrontmatterFelder(
  markdown: string,
  felder: Record<string, unknown>,
): string {
  const eintraege = Object.entries(felder)
  if (eintraege.length === 0) throw new Error('Keine Felder angegeben')

  const patch: Record<string, string> = {}
  for (const [key, wert] of eintraege) {
    pruefeFeld(key, wert)
    patch[key] = formatiereWert(wert)
  }

  const gepatcht = patchStandZeilen(markdown, patch)

  // Rueckprobe mit dem echten Parser — die Chirurgie muss sich beweisen,
  // nicht behauptet werden.
  const gelesen = parseFrontmatter(gepatcht).meta
  for (const [key, wert] of eintraege) {
    if (gelesen[key] !== wert) {
      throw new Error(
        `Rueckprobe fehlgeschlagen fuer "${key}": geschrieben ${JSON.stringify(wert)}, ` +
        `zurueckgelesen ${JSON.stringify(gelesen[key])} — abgebrochen, nichts geschrieben.`,
      )
    }
  }
  return gepatcht
}

/**
 * Ergaenzt Listen-Felder (Welle W3) — Dubletten werden erkannt, nicht
 * angehaengt.
 *
 * Geschrieben wird die YAML-Flow-Form (`[a, b]`), weil sie als einzige durch
 * dieselbe Rueckprobe kommt wie die Skalar-Felder: Der Parser liest sie als
 * Rohstring zurueck, und geschrieben wie gelesen sind derselbe String.
 * Begruendung und die verworfene Blockform stehen in `frontmatter-listen.ts`.
 */
export function ergaenzeFrontmatterListen(
  markdown: string,
  felder: Record<string, readonly string[]>,
): { inhalt: string; beschreibung: string } {
  const keys = Object.keys(felder)
  if (keys.length === 0) throw new Error('Keine Felder angegeben')
  for (const key of keys) {
    if (!KEY_MUSTER.test(key)) {
      throw new Error(
        `Ungueltiger Frontmatter-Key "${key}": erlaubt sind flache snake_case-Keys ` +
        '(Kleinbuchstaben, Ziffern, Unterstrich).',
      )
    }
  }

  const { neueWerte, ergaenzt, uebersprungen } = berechneErgaenzung(markdown, felder)
  const gepatcht = patchStandZeilen(markdown, neueWerte)

  // Dieselbe Rueckprobe wie beim Setzen — die Chirurgie muss sich beweisen.
  const gelesen = parseFrontmatter(gepatcht).meta
  for (const [key, wert] of Object.entries(neueWerte)) {
    if (gelesen[key] !== wert) {
      throw new Error(
        `Rueckprobe fehlgeschlagen fuer "${key}": geschrieben ${JSON.stringify(wert)}, ` +
        `zurueckgelesen ${JSON.stringify(gelesen[key])} — abgebrochen, nichts geschrieben.`,
      )
    }
  }

  const teile = keys.map((key) => {
    const dazu = ergaenzt[key]
    const schon = uebersprungen[key]
    const schonText = schon.length > 0 ? `, ${schon.length} schon vorhanden (${schon.join(', ')})` : ''
    return `${key}: ${dazu.length} ergaenzt${dazu.length > 0 ? ` (${dazu.join(', ')})` : ''}${schonText}`
  })
  return { inhalt: gepatcht, beschreibung: teile.join(' · ') }
}
