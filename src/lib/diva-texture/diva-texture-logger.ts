/**
 * @fileoverview Logging der Sidecar-Match-Versuche (Stufe 1).
 *
 * @description
 * Protokolliert ALLE Match-Versuche (auch Misses) ueber den zentralen
 * FileLogger (erscheint im Debug-Panel + Server-Konsole) — dient der
 * User-Verifikation der Matcher-Heuristik (Plan Edge-Case #2).
 *
 * Hinweis: Das urspruengliche Brief nannte "Pino-Logging". Das Repo nutzt
 * jedoch durchgaengig FileLogger (src/lib/debug/logger.ts) und hat pino nicht
 * als Dependency — bewusste, mit dem User abgestimmte Abweichung.
 */

import { FileLogger } from '@/lib/debug/logger'
import type { MatchAttempt, MatchResult } from './types'

/** Formatiert einen Match-Versuch als kompakte Log-Zeile. */
function formatAttempt(a: MatchAttempt): string {
  const mark = a.matched ? 'HIT ' : 'miss'
  return `[${mark}] ${a.strategy} (${a.field}) ${a.candidate} ~ ${a.target} #${a.entryKey}`
}

/**
 * Loggt das Match-Ergebnis inkl. aller Versuche fuer einen Texturdateinamen.
 */
export function logMatchAttempts(fileName: string, result: MatchResult): void {
  FileLogger.info('diva-texture-matcher', 'Sidecar-Match-Versuche', {
    fileName,
    matched: result.match !== null,
    strategy: result.match?.strategy ?? null,
    matchedPftFile: result.match?.entry.PFTFile ?? null,
    matchedVCodex: result.match?.entry.VCodex ?? null,
    attemptCount: result.attempts.length,
    attempts: result.attempts.map(formatAttempt),
  })

  if (result.match === null) {
    FileLogger.warn('diva-texture-matcher', 'Kein Sidecar-Treffer fuer Textur', {
      fileName,
      triedStrategies: Array.from(new Set(result.attempts.map((a) => a.strategy))),
    })
  }
}
