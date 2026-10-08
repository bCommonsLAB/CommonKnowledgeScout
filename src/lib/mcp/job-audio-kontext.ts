/**
 * @fileoverview Audio-Kontext eines Jobs fuer `job_status` (Welle B): reine Funktion.
 *
 * @description
 * Welche Transkriptions-Optionen am Audio-Job haengen — damit der Weg (mit
 * oder ohne Sprecher-Erkennung) auch NACH dem Start sichtbar bleibt.
 * `sprecherErkennung` null heisst: nicht im Aufruf gesetzt, die Start-Route
 * nimmt die Library-Voreinstellung (speakerModeSource im Trace).
 *
 * @module mcp
 */

export interface AudioKontextSicht {
  sprecherErkennung: boolean | null
  weg: string
  kontext: string | null
  begriffe: string[]
}

export function audioKontextVonJob(job: { correlation?: { options?: Record<string, unknown> } }): AudioKontextSicht {
  const o = job.correlation?.options ?? {}
  const speakerMode = typeof o.speakerMode === 'boolean' ? o.speakerMode : null
  return {
    sprecherErkennung: speakerMode,
    weg: speakerMode === null
      ? 'Library-Voreinstellung (siehe Trace speakerModeSource)'
      : (speakerMode ? 'mit_sprechererkennung' : 'ohne_sprechererkennung'),
    kontext: typeof o.audioPrompt === 'string' ? o.audioPrompt : null,
    begriffe: Array.isArray(o.audioKeywords) ? o.audioKeywords.filter((k): k is string => typeof k === 'string') : [],
  }
}
