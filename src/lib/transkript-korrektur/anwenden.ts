/**
 * @fileoverview Korrektur auf ein Transkript anwenden (P3b) — pur.
 *
 * @description
 * Gemeinsamer Kern fuer die Bruecke (`transkript_korrigieren`) und den
 * Reiter „Korrektur" in der Oberflaeche: Ersetzungen und Sprecher-Zuordnung
 * auf den Body anwenden, Revisions-Felder stempeln, `speaker_names` flach ins
 * Frontmatter legen. Kein I/O; wirft bei nicht eindeutigen oder fehlenden
 * Stellen (siehe `wendeErsetzungenAn`) — dann schreibt der Aufrufer nichts.
 *
 * Sprecher-Zuordnung = Praefix-Ersetzung im Body (`**Stueck 1 Sprecher A:**`
 * wird zu `**Name:**`, jedes Vorkommen) plus Frontmatter `speaker_names` als
 * Liste von Strings `Label: Name`. `speakers` (die Labels) bleibt als Herkunft
 * stehen. Flach und Obsidian-kompatibel (Frontmatter-Regel in AGENTS.md).
 *
 * @module transkript-korrektur
 */

import { createMarkdownWithFrontmatter } from '@/lib/markdown/compose'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { wendeErsetzungenAn, type Ersetzung, type ErsetzungBeleg } from '@/lib/mcp/transkript-korrektur'

/** Flaches Frontmatter-Feld: `["Stueck 1 Sprecher A: Dr. Anna Mahlknecht", …]`. */
export const SPEAKER_NAMES_FRONTMATTER_KEY = 'speaker_names'

export interface SprecherZuordnung {
  /** Label, wie es als Praefix im Body steht, z. B. `Stück 1 Sprecher A`. */
  label: string
  /** Bestaetigter Name der Person. */
  name: string
}

export interface Revision {
  revised_by: string
  revised_at: string
  revision_note: string
}

export interface KorrekturAnwendung {
  markdown: string
  ersetzungen: readonly Ersetzung[]
  sprecher: readonly SprecherZuordnung[]
  revision: Revision
}

export interface KorrekturAnwendungErgebnis {
  markdownNeu: string
  belege: ErsetzungBeleg[]
  /** Vollstaendige Liste nach dem Zusammenfuehren mit vorhandenen Eintraegen. */
  speakerNames: string[]
}

/** Praefix eines Sprecher-Labels im Body (so schreibt `extract-audio-text.ts` die Absaetze). */
export function sprecherPraefix(label: string): string {
  return `**${label}:**`
}

/** Sprecher-Zuordnung als Ersetzungen — jedes Vorkommen des Praefixes. */
export function sprecherErsetzungen(sprecher: readonly SprecherZuordnung[]): Ersetzung[] {
  return sprecher.map((eintrag, index) => {
    const label = eintrag.label.trim()
    const name = eintrag.name.trim()
    if (!label) throw new Error(`Sprecher ${index + 1}: Label fehlt`)
    if (!name) throw new Error(`Sprecher ${index + 1} ("${label}"): Name fehlt`)
    if (name === label) throw new Error(`Sprecher ${index + 1} ("${label}"): Name ist gleich dem Label — nichts zu tun`)
    return { alt: sprecherPraefix(label), neu: sprecherPraefix(name), alle: true }
  })
}

/** `Label: Name`-Eintraege lesen; fremde oder leere Werte fallen weg. */
export function parseSpeakerNames(value: unknown): Map<string, string> {
  const out = new Map<string, string>()
  if (!Array.isArray(value)) return out
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const trenner = entry.indexOf(':')
    if (trenner <= 0) continue
    const label = entry.slice(0, trenner).trim()
    const name = entry.slice(trenner + 1).trim()
    if (label && name) out.set(label, name)
  }
  return out
}

/** Vorhandene Eintraege behalten, neue ueberschreiben je Label, Reihenfolge der Labels erhalten. */
export function mergeSpeakerNames(existing: unknown, sprecher: readonly SprecherZuordnung[]): string[] {
  const merged = parseSpeakerNames(existing)
  for (const eintrag of sprecher) merged.set(eintrag.label.trim(), eintrag.name.trim())
  return [...merged.entries()].map(([label, name]) => `${label}: ${name}`)
}

/**
 * Wendet Ersetzungen und Sprecher-Zuordnung an — alles oder nichts. Die
 * Ersetzungen des Anwenders laufen zuerst (Hoerfehler im Text), danach die
 * Praefixe der Sprecher; `generated_*` bleibt, die drei Revisions-Felder
 * kommen dazu bzw. werden ueberschrieben.
 */
export function wendeKorrekturAn(args: KorrekturAnwendung): KorrekturAnwendungErgebnis {
  const { markdown, ersetzungen, sprecher, revision } = args
  const alle: Ersetzung[] = [...ersetzungen, ...sprecherErsetzungen(sprecher)]
  if (alle.length === 0) throw new Error('Keine Ersetzung und keine Sprecher-Zuordnung — nichts zu schreiben')

  const { meta, body } = parseFrontmatter(markdown)
  const { body: neuerBody, belege } = wendeErsetzungenAn(body, alle)

  const metaNeu: Record<string, unknown> = { ...meta, ...revision }
  const speakerNames = sprecher.length > 0
    ? mergeSpeakerNames(meta[SPEAKER_NAMES_FRONTMATTER_KEY], sprecher)
    : [...parseSpeakerNames(meta[SPEAKER_NAMES_FRONTMATTER_KEY]).entries()].map(([l, n]) => `${l}: ${n}`)
  if (speakerNames.length > 0) metaNeu[SPEAKER_NAMES_FRONTMATTER_KEY] = speakerNames

  return { markdownNeu: createMarkdownWithFrontmatter(neuerBody, metaNeu), belege, speakerNames }
}
