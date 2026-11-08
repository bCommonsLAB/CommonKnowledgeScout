/**
 * @fileoverview SITZUNGEN.md und Bericht-Block „Sitzungen" rendern (S1).
 *
 * @description
 * Dieselbe Zeile an beiden Orten: `- JJJJ-MM-TT · Code · [[Beleg]] — Teaser`.
 * Die Chronik gruppiert je Vorhaben in Archiv-Ordnung (Owner-Entscheid E1,
 * 08.11.2026), zuletzt „Ohne Vorhaben"; der Block traegt nur die Sitzungen
 * eines Vorhabens und steht zwischen den Markern aus `sitzungen-block.ts`.
 * Reine Funktionen.
 *
 * @module agent-view/sichten
 */

import { sichtFrontmatter } from './aktuell-render'
import { datumKurz } from './types'
import { gruppiereNachVorhaben, sortiereSitzungen, type SitzungsDatensatz } from './sitzungen-types'

export const SITZUNGEN_BLOCK_START = '<!-- sitzungen:start -->'
export const SITZUNGEN_BLOCK_END = '<!-- sitzungen:end -->'
/** Ueberschrift des erzeugten Blocks — unterscheidet sich bewusst von „(nachgetragen …)" der Handarbeit. */
export const SITZUNGEN_BLOCK_UEBERSCHRIFT = '### Sitzungen mit Claude (erzeugt)'

/** Eine Zeile je Sitzung; Art-Wort „?" macht einen Beleg ohne Konvention sichtbar statt ihn zu verstecken. */
export function sitzungsZeile(s: SitzungsDatensatz): string {
  const ende = s.ende !== null ? ` (bis ${s.ende})` : ''
  const teaser = s.teaser !== '' ? ` — ${s.teaser}` : ''
  return `- ${s.datum}${ende} · ${s.artWort ?? '?'} · [[${s.belegName}]]${teaser}`
}

export function renderSitzungen(sitzungen: readonly SitzungsDatensatz[], now: Date): string {
  const gruppen = gruppiereNachVorhaben(sitzungen)
  const vorhaben = gruppen.filter((g) => g.pfad !== null).length
  const z: string[] = []
  z.push('# SITZUNGEN — Chronik der Arbeitssitzungen mit Claude', '')
  z.push(`Erzeugt am ${datumKurz(now)} aus den Sitzungsnotizen (Vorlage \`chatverlauf-de\`) — **nicht von Hand pflegen.**`)
  z.push('Gepflegt werden die Belege in den Vorhabensordnern; diese Chronik wird daraus')
  z.push('erzeugt (KnowledgeScout, Werkzeug `sichten_regenerieren`).', '')
  z.push(`**${sitzungen.length} Sitzungen in ${vorhaben} Vorhaben**, je Vorhaben chronologisch (älteste zuerst).`, '', '---', '')
  if (gruppen.length === 0) z.push('Keine Sitzungsnotizen gefunden.', '')
  for (const g of gruppen) {
    z.push(`## ${g.pfad ?? 'Ohne Vorhaben'} (${g.sitzungen.length})`, '')
    for (const s of g.sitzungen) z.push(sitzungsZeile(s))
    z.push('')
  }
  const kopf = sichtFrontmatter('sitzungen', now, [
    ['anzahl_sitzungen', sitzungen.length],
    ['anzahl_vorhaben', vorhaben],
  ])
  return kopf + z.join('\n')
}

/** Block fuer EIN Vorhaben, Marker inklusive (so wie `erschliessungsBloecke` ihn liefert). */
export function sitzungenBlock(sitzungen: readonly SitzungsDatensatz[], heute: string): string {
  const z = [SITZUNGEN_BLOCK_START, SITZUNGEN_BLOCK_UEBERSCHRIFT, '']
  z.push(`Stand ${heute} — erzeugt von KnowledgeScout (\`sitzungen_block_schreiben\`), nicht von Hand pflegen.`, '')
  for (const s of sortiereSitzungen(sitzungen)) z.push(sitzungsZeile(s))
  z.push(SITZUNGEN_BLOCK_END)
  return z.join('\n')
}
