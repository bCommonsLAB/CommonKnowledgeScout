/**
 * @fileoverview Ereignisse der Lesersicht aus dem Job-Trace (Welle K2).
 *
 * @description
 * Die Spezifikation 2.47.0 versprach Trace-Ereignisse (`cover_source`,
 * `attachments_source`, `slide_images_resolved`), die der Ingest auch
 * schreibt — `job_status` zeigte den Trace aber nur im Fehlerfall
 * (`fehlerDetailsAusTrace`). Ein Index-Lauf mit 0 von 58 Bildern war
 * `completed`, und die Erklaerung lag in der Datenbank.
 *
 * Diese Datei liest aus `trace.events` genau die Ereignisse einer FESTEN
 * Namensliste (Ingest-Span und Seitenbild-Registrierung der Extraktion), je
 * Ereignis Name, Zeitpunkt und Attribute — nicht den ganzen Trace. Dazu die
 * Log-Phasen derselben Liste, die nur in `job.logs` stehen
 * (`frontmatter_json_list_invalid` schreibt der Ingest als Log, nicht als
 * Trace-Ereignis). Derselbe Weg wie `job-fehler-details.ts`: `unknown` plus
 * Type-Guards, weil der Trace in `ExternalJob` nicht typisiert ist.
 *
 * @module mcp
 */

/** Ereignisnamen der Lesersicht — Ingest-Span (ingestion-service.ts) und Extraktion (extract-page-images-register.ts). */
export const LESERSICHT_EREIGNISSE = [
  'slide_images_resolved',
  'slide_images_unresolved',
  'cover_source',
  'audio_source',
  'attachments_source',
  'attachments_links_rewritten',
  'extract_only_page_images_registered',
  'extract_only_page_images_skipped',
  'extract_only_page_images_error',
  'frontmatter_json_list_invalid',
] as const

export type LesersichtEreignisName = (typeof LESERSICHT_EREIGNISSE)[number]

export interface JobEreignis {
  name: LesersichtEreignisName
  zeitpunkt: string | null
  /** `trace` = Ereignis aus trace.events, `log` = Log-Eintrag mit dieser Phase (nur, wenn kein Trace-Ereignis gleichen Namens). */
  quelle: 'trace' | 'log'
  attribute: Record<string, unknown>
}

/** Attribute von `slide_images_resolved` und Namen aus `slide_images_unresolved`, zusammengefasst. */
export interface FolienBilanz { aufgeloest: number; unaufgeloest: number; namen: string[] }

const NAMEN = new Set<string>(LESERSICHT_EREIGNISSE)

function istName(wert: unknown): wert is LesersichtEreignisName {
  return typeof wert === 'string' && NAMEN.has(wert)
}

function alsObjekt(wert: unknown): Record<string, unknown> | null {
  return wert !== null && typeof wert === 'object' && !Array.isArray(wert) ? (wert as Record<string, unknown>) : null
}

function zeit(wert: unknown): string | null {
  if (wert instanceof Date) return wert.toISOString()
  return typeof wert === 'string' ? wert : null
}

/**
 * Ereignisse der Lesersicht in zeitlicher Reihenfolge. Leeres Array heisst:
 * der Job hat keines geschrieben — bei einem Job ohne Ingest richtig, bei
 * einem Ingest-Job vor 2.47.0 ein Hinweis auf den alten Stand.
 */
export function ereignisseAusTrace(job: unknown): JobEreignis[] {
  const wurzel = alsObjekt(job)
  const trace = alsObjekt(wurzel?.['trace'])
  const roh = trace?.['events']
  const ereignisse: JobEreignis[] = []
  if (Array.isArray(roh)) {
    for (const eintrag of roh) {
      const ereignis = alsObjekt(eintrag)
      if (!ereignis || !istName(ereignis['name'])) continue
      ereignisse.push({ name: ereignis['name'], zeitpunkt: zeit(ereignis['ts']), quelle: 'trace', attribute: alsObjekt(ereignis['attributes']) ?? {} })
    }
  }
  const imTrace = new Set(ereignisse.map((e) => e.name))
  const logs = wurzel?.['logs']
  if (Array.isArray(logs)) {
    for (const eintrag of logs) {
      const log = alsObjekt(eintrag)
      if (!log || !istName(log['phase']) || imTrace.has(log['phase'])) continue
      const { timestamp, phase, ...rest } = log
      void phase
      ereignisse.push({ name: log['phase'], zeitpunkt: zeit(timestamp), quelle: 'log', attribute: rest })
    }
  }
  return ereignisse
}

/** `cover_source.source` des juengsten Cover-Ereignisses — `slides | flyer | none`, oder null ohne Ereignis. */
export function coverQuelleAus(ereignisse: readonly JobEreignis[]): { quelle: string; grund: string | null; seite: number | null } | null {
  const letzte = [...ereignisse].reverse().find((e) => e.name === 'cover_source')
  if (!letzte) return null
  const source = letzte.attribute['source']
  const grund = letzte.attribute['grund']
  const page = letzte.attribute['page']
  return {
    quelle: typeof source === 'string' ? source : 'unbekannt',
    grund: typeof grund === 'string' ? grund : null,
    seite: typeof page === 'number' ? page : null,
  }
}

/** Folien-Bilanz aus `slide_images_resolved` (Zaehler) und `slide_images_unresolved` (Namen); null ohne Ereignis. */
export function folienAus(ereignisse: readonly JobEreignis[]): FolienBilanz | null {
  const resolved = [...ereignisse].reverse().find((e) => e.name === 'slide_images_resolved')
  if (!resolved) return null
  const a = resolved.attribute
  const unresolved = [...ereignisse].reverse().find((e) => e.name === 'slide_images_unresolved')
  const namen = Array.isArray(unresolved?.attribute['unresolved'])
    ? (unresolved!.attribute['unresolved'] as unknown[]).filter((n): n is string => typeof n === 'string')
    : []
  return {
    aufgeloest: typeof a['resolved'] === 'number' ? a['resolved'] : 0,
    unaufgeloest: typeof a['unresolved'] === 'number' ? a['unresolved'] : namen.length,
    namen,
  }
}
