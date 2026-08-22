/**
 * @fileoverview BERICHT.md → ProjektDatensatz (Wunschliste 2, W1).
 *
 * @description
 * Liest, was `aktuell.py`/`projekte.py` aus einem Bericht ziehen: Frontmatter-
 * Felder, H1, erster Absatz und die offenen Checkboxen unter
 * „## Nächste Schritte" (eingerueckte Folgezeilen gehoeren zum Punkt).
 * Grundlage ist der `ArchiveDocEntry` des Archiv-Scans — der Scan liest
 * Contract-Dateien ohnehin komplett. Reine Funktionen, kein I/O.
 *
 * @module agent-view/sichten
 */

import type { ArchiveFolderNode } from '../archive-types'
import { sauber, type ProjektDatensatz } from './types'

function asString(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'number') return String(value)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => asString(v)).filter((v): v is string => v !== null)
  const single = asString(value)
  if (single === null) return []
  // Flaches Frontmatter darf `[a, b]` als String tragen (Minimal-YAML der Skripte).
  if (single.startsWith('[') && single.endsWith(']')) {
    return single.slice(1, -1).split(',').map((v) => v.trim()).filter(Boolean)
  }
  return [single]
}

export function titelLesen(body: string): string {
  const match = body.match(/^# (.+)$/m)
  return match ? match[1].trim() : ''
}

/** Erster Absatz nach der H1 (Kurzbeschreibung des Vorhabens). */
export function ersterAbsatz(body: string): string {
  const h1 = body.match(/^# .+$/m)
  if (!h1 || h1.index === undefined) return ''
  const rest = body.slice(h1.index + h1[0].length).replace(/^\n+/, '')
  const absatz: string[] = []
  for (const zeile of rest.split('\n')) {
    if (zeile.trim() === '') {
      if (absatz.length > 0) break
      continue
    }
    if (zeile.startsWith('#')) break
    absatz.push(zeile.trim())
  }
  return sauber(absatz.join(' '))
}

/** Offene Checkboxen unter „## Nächste Schritte"; umbrochene Punkte werden zusammengefuegt. */
export function offenePunkte(body: string): string[] {
  const match = body.match(/^## Nächste Schritte\s*$([\s\S]+?)(?=^## |(?![\s\S]))/m)
  if (!match) return []
  const punkte: string[] = []
  for (const zeile of match[1].split('\n')) {
    const offen = zeile.trim().match(/^- \[ \] (.+)$/)
    if (offen) {
      punkte.push(offen[1].trim())
    } else if (punkte.length > 0 && zeile.startsWith('      ') && zeile.trim() !== '') {
      punkte[punkte.length - 1] += ` ${zeile.trim()}`
    }
  }
  return punkte.map(sauber)
}

/** Liest einen Bericht-Knoten des Scans in den Datensatz; null = Bericht ohne Frontmatter. */
export function projektAusBericht(folder: ArchiveFolderNode): ProjektDatensatz | null {
  const bericht = folder.bericht
  if (!bericht || Object.keys(bericht.meta).length === 0) return null
  const meta = bericht.meta
  return {
    ordner: folder.path,
    titel: titelLesen(bericht.body),
    projekt: asString(meta.projekt) ?? '',
    status: asString(meta.status),
    rolle: asString(meta.rolle),
    bereich: asString(meta.bereich),
    begonnen: asString(meta.begonnen),
    letzteAktivitaet: asString(meta.letzte_aktivitaet),
    naechsterTermin: asString(meta.naechster_termin),
    terminFixiert: asString(meta.termin_fixiert) !== 'nein',
    plattform: asString(meta.plattform),
    repo: asList(meta.repo),
    themen: asList(meta.themen),
    quelle: asString(meta.quelle),
    beschreibung: ersterAbsatz(bericht.body),
    schritte: offenePunkte(bericht.body),
  }
}

/** Alle Vorhaben eines Scans, sortiert nach Ordnerpfad (deterministisch wie `sorted(rglob)`). */
export function sammleProjekte(folders: readonly ArchiveFolderNode[]): ProjektDatensatz[] {
  return [...folders]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(projektAusBericht)
    .filter((p): p is ProjektDatensatz => p !== null)
}

/**
 * Zaehlt Projektordner (Abdeckungs-Nenner von PROJEKTE.md, wie `abdeckung()` im
 * Skript): Kinder der Bereiche `N. …`/`Crystal Design`, ohne `0. Inbox`/`9. Wissen`,
 * ohne `.`/`_`-Ordner.
 */
export function zaehleProjektordner(folders: readonly ArchiveFolderNode[]): number {
  const bereiche = folders.filter(
    (f) =>
      f.depth === 1 &&
      (/^\d\. /.test(f.name) || f.name === 'Crystal Design') &&
      !f.name.startsWith('0. ') &&
      !f.name.startsWith('9. '),
  )
  const bereichIds = new Set(bereiche.map((f) => f.folderId))
  return folders.filter(
    (f) =>
      f.depth === 2 &&
      f.parentFolderId !== null &&
      bereichIds.has(f.parentFolderId) &&
      !f.name.startsWith('.') &&
      !f.name.startsWith('_'),
  ).length
}
