/**
 * @fileoverview Server-Sperre der Archivpflege-Werkzeuge der MCP-Bruecke.
 *
 * @description
 * Die Bruecke gilt fuer ALLE Libraries eines Kontos. Einige Werkzeuge setzen
 * aber die Struktur des Wissensarchivs voraus (`_INDEX.md`, `BERICHT.md`,
 * Sichten unter `Organisation/`) und SCHREIBEN sie — in einer anders gebauten
 * Library legten sie diese Struktur ungefragt an. Freigabe ist derselbe
 * Schalter wie in der Oberflaeche: `config.agentView.enabled === true`.
 *
 * Kein stiller Fallback: Eine nicht freigegebene Library wird laut
 * abgewiesen, nicht uebersprungen (`no-silent-fallbacks`).
 *
 * @module mcp
 */

import type { Library } from '@/types/library'

/** Werkzeuge, die die Archiv-Struktur voraussetzen oder schreiben und deshalb gesperrt sind. */
export const ARCHIVPFLEGE_WERKZEUGE = [
  'stand_setzen',
  'themen_setzen',
  'erschliessung_block_schreiben',
  'sichten_regenerieren',
  // S1: schreibt den Sitzungen-Block in BERICHT.md.
  'sitzungen_block_schreiben',
  // R1: Sitzungs-Register — Belege und Vorhaben gibt es nur im Wissensarchiv.
  'sitzungen_melden',
  'sitzungen_auflisten',
  'sitzung_setzen',
  // R2: Einmal-Import der Arbeitsliste.
  'sitzungen_importieren',
  // R4: Sitzung abschliessen (Beleg, Register, Notiz-Job).
  'sitzung_abschliessen',
] as const

export type ArchivpflegeWerkzeug = (typeof ARCHIVPFLEGE_WERKZEUGE)[number]

/** Ist die Archivpflege fuer diese Library freigegeben? */
export function archivpflegeAktiv(library: Pick<Library, 'config'>): boolean {
  return library.config?.agentView?.enabled === true
}

export class ArchivpflegeGesperrtError extends Error {
  constructor(werkzeug: ArchivpflegeWerkzeug, libraryLabel: string) {
    super(
      `${werkzeug} ist fuer die Library "${libraryLabel}" gesperrt: Sie fuehrt keine Archiv-Konventionen ` +
      '(Agentensicht nicht aktiviert). Das Werkzeug setzt Archiv-Strukturen (_INDEX.md, BERICHT.md, ' +
      'Sitzungs-Register) voraus oder legt sie an, die diese Library nicht kennt. Freigabe: Library-Einstellungen → Agentensicht aktivieren. ' +
      'Die generischen Werkzeuge (Storage, Erschliessen, Twins, Jobs) bleiben nutzbar.',
    )
    this.name = 'ArchivpflegeGesperrtError'
  }
}

/** Wirft, wenn die Library die Archivpflege nicht freigegeben hat. */
export function pruefeArchivpflege(
  library: Pick<Library, 'config' | 'label'>,
  werkzeug: ArchivpflegeWerkzeug,
): void {
  if (!archivpflegeAktiv(library)) throw new ArchivpflegeGesperrtError(werkzeug, library.label)
}

/** Vorsatz der Werkzeugbeschreibungen — der Agent sieht die Sperre vor dem Aufruf. */
export const ARCHIVPFLEGE_HINWEIS =
  'NUR fuer Libraries mit archivpflege: true (siehe bibliotheken_auflisten), sonst Fehler. '
