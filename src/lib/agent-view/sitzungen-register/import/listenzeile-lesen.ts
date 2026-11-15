/**
 * @fileoverview Eine Zeile der Arbeitsliste deuten (R2). Reine Funktion.
 *
 * @description
 * Aus den Spalten werden Kennung, Verweis, Entscheidung und Vorhaben gelesen:
 * - Quelle: `Code lokal` → code_lokal, `Code Cloud` → code_cloud, `Chat 2024/25`
 *   → chat. `Cowork/Chat` (Teil B) trennt die Liste selbst ueber den
 *   Export-Vermerk: Der Anthropic-Export (`conversations.json`) enthaelt nur
 *   claude.ai-Chats, Cowork-Verlaeufe liegen in keinem Zip (Nachtrag
 *   „Anthropic-Datenexport", 08.11.: 41 Zeilen im Export, 102 Cowork). Mit
 *   Vermerk → chat, ohne → cowork. Eine unbekannte Quelle ist ein Fehler.
 * - Kennung: `session_…` aus dem Sitzungs-Link (Teil D), sonst das
 *   Export-Kuerzel `conversations.json \`xxxxxxxx\`` (Teile B/C).
 * - Bemerkung: `erledigt JJJJ-MM-TT, [[Notizname]]`, `überspringen: <Grund>`,
 *   `Vorhaben: <Ordner> (+ <weitere>)`, `Notiz vorhanden: [[…]]`.
 * - Vorhaben ohne Angabe in der Bemerkung: letzter Pfadteil des Abschnitts;
 *   Abschnitte ohne `/` (Ohne Zuordnung, Uebersprungen, Altbestand) → keins.
 *
 * @module agent-view/sitzungen-register/import
 */

import type { SitzungsQuelle } from '../types'
import type { ListenZeile } from './arbeitsliste-parsen'

export interface ListenEintrag extends ListenZeile {
  quelle: SitzungsQuelle
  exportPraefix: string | null
  /** Volle Kennung aus dem Sitzungs-Link (`session_…`). */
  kennungAusLink: string | null
  link: string | null
  repo: string | null
  branch: string | null
  prs: string[]
  erledigtAm: string | null
  /** Wikilink nach „erledigt": Name der Notiz bzw. des Belegs ohne Art-Wort. */
  belegVerweis: string | null
  ueberspringenGrund: string | null
  vorhaben: string | null
  nebenvorhaben: string[]
  notizVorhanden: string | null
}

/** `null` = Teil B, die Quelle haengt am Export-Vermerk (`quelleTeilB`). */
const QUELLEN: Readonly<Record<string, SitzungsQuelle | null>> = {
  'Code lokal': 'code_lokal',
  'Code Cloud': 'code_cloud',
  'Chat 2024/25': 'chat',
  'Cowork/Chat': null,
}

/** Teil B: im Anthropic-Export → claude.ai-Chat; sonst Cowork (dort ist kein Verlauf exportiert). */
function quelleTeilB(exportPraefix: string | null): SitzungsQuelle {
  return exportPraefix !== null ? 'chat' : 'cowork'
}

const EXPORT = /conversations\.json `([0-9a-f]{8})`/
const LINK = /\((https:\/\/claude\.ai\/code\/(session_[A-Za-z0-9]+))\)/
const ERLEDIGT = /erledigt (\d{4}-\d{2}-\d{2})(?:, \[\[([^\]]+)\]\])?/
const UEBERSPRINGEN = /überspringen: ([^;]+)/
const VORHABEN = /(?:^|; )Vorhaben: ([^;(]+?)(?: \(\+ ([^)]+)\))?\s*(?=;|$)/
const NOTIZ = /Notiz vorhanden: \[\[([^\]]+)\]\]/
const PR_URL = /https:\/\/github\.com\/[^\s)]+\/pull\/\d+/g
const PR_NR = /#(\d+)/g
const BRANCH = /`([^`]+)`/

function vorhabenAusAbschnitt(abschnitt: string): string | null {
  const i = abschnitt.lastIndexOf('/')
  return i < 0 ? null : abschnitt.slice(i + 1).trim()
}

export function leseListenzeile(z: ListenZeile): ListenEintrag {
  const quelleListe = QUELLEN[z.quelleRoh]
  if (quelleListe === undefined) throw new Error(`Zeile ${z.zeile} (${z.nr}): unbekannte Quelle „${z.quelleRoh}"`)
  const exportPraefix = z.bemerkung.match(EXPORT)?.[1] ?? null
  const quelle = quelleListe ?? quelleTeilB(exportPraefix)
  const link = z.repoRoh.match(LINK)
  const repoTeil = z.repoRoh.split(' · ')[0]?.trim() ?? ''
  const repo = repoTeil !== '' && !repoTeil.startsWith('[') ? repoTeil : null
  const prs = new Set<string>()
  for (const m of `${z.repoRoh} ${z.bemerkung}`.matchAll(PR_URL)) prs.add(m[0])
  if (repo !== null) for (const m of z.repoRoh.matchAll(PR_NR)) prs.add(`${repo}#${m[1]}`)
  const erledigt = z.bemerkung.match(ERLEDIGT)
  const vorhaben = z.bemerkung.match(VORHABEN)
  const keinVorhaben = /kein Vorhaben/.test(z.bemerkung)
  return {
    ...z,
    quelle,
    exportPraefix,
    kennungAusLink: link?.[2] ?? null,
    link: link?.[1] ?? null,
    repo,
    branch: z.repoRoh.match(BRANCH)?.[1] ?? null,
    prs: [...prs],
    erledigtAm: erledigt?.[1] ?? null,
    belegVerweis: erledigt?.[2]?.trim() ?? null,
    ueberspringenGrund: z.bemerkung.match(UEBERSPRINGEN)?.[1].trim() ?? null,
    vorhaben: vorhaben ? vorhaben[1].trim() : keinVorhaben ? null : vorhabenAusAbschnitt(z.abschnitt),
    nebenvorhaben: vorhaben?.[2] ? vorhaben[2].split(',').map((s) => s.trim()).filter(Boolean) : [],
    notizVorhanden: z.bemerkung.match(NOTIZ)?.[1].trim() ?? null,
  }
}
