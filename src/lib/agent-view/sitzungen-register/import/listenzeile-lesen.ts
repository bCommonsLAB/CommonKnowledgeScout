/**
 * @fileoverview Eine Zeile der Arbeitsliste deuten (R2). Reine Funktion.
 *
 * @description
 * Aus den Spalten werden Kennung, Verweis, Entscheidung und Vorhaben gelesen:
 * - Quelle: `Code lokal` → code_lokal, `Code Cloud` → code_cloud, `Chat 2024/25`
 *   → chat, `Cowork/Chat` → chat. Teil B mischt Cowork und Chat; die Liste
 *   trennt es nicht, darum `chat` — die Unterscheidung ist ein offener Befund
 *   (15.11.), kein stiller Ersatz. Eine unbekannte Quelle ist ein Fehler.
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

const QUELLEN: Readonly<Record<string, SitzungsQuelle>> = {
  'Code lokal': 'code_lokal',
  'Code Cloud': 'code_cloud',
  'Chat 2024/25': 'chat',
  'Cowork/Chat': 'chat',
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
  const quelle = QUELLEN[z.quelleRoh]
  if (quelle === undefined) throw new Error(`Zeile ${z.zeile} (${z.nr}): unbekannte Quelle „${z.quelleRoh}"`)
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
    exportPraefix: z.bemerkung.match(EXPORT)?.[1] ?? null,
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
