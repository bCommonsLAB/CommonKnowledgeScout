/**
 * @fileoverview Zeitgrenze fuer Uebersetzungsaufrufe beim Secretary
 *
 * @description
 * Die Uebersetzung eines Dokuments ist EIN synchroner Aufruf an
 * `/transformer/template`. Seine Dauer waechst mit der Textmenge, weil das
 * LLM den ganzen Text neu ausgibt. Bis 18.11.2026 galt fest 60 s; damit
 * scheiterten bei SFSCON 440 Paare mit „Request timed out", fast alle ueber
 * 15.000 Zeichen (Median 19.000). Gemessen an 1.261 fertigen Jobs braucht der
 * Secretary im Median rund 4 s, im P90 rund 7 s je 1.000 Zeichen.
 *
 * Deshalb: 60 s Grundzeit plus 7 s je angefangene 1.000 Zeichen, hoechstens
 * 240 s. Die Obergrenze liegt unter der Wartezeit des Workers auf die
 * Start-Route (`JOBS_WORKER_START_TIMEOUT_MS`, Vorgabe 300 s); der Job braucht
 * danach noch Zeit, um das Ergebnis zu schreiben.
 *
 * @usedIn
 * - src/lib/chat/common/document-translation.ts: alle vier Translator-Helfer
 */

import { callTemplateTransform, type TemplateTransformParams } from '@/lib/secretary/adapter'
import { TimeoutError } from '@/lib/utils/fetch-with-timeout'

export const TRANSLATION_TIMEOUT_MIN_MS = 60_000
export const TRANSLATION_TIMEOUT_MAX_MS = 240_000
const MS_PER_1000_CHARS = 7_000

/** Zeitgrenze in ms fuer einen Text der Laenge `textLength` (Zeichen). */
export function translationTimeoutMs(textLength: number): number {
  if (!Number.isFinite(textLength) || textLength < 0) {
    throw new Error(`Ungueltige Textlaenge fuer die Uebersetzungs-Zeitgrenze: ${textLength}`)
  }
  const scaled = TRANSLATION_TIMEOUT_MIN_MS + Math.ceil(textLength / 1000) * MS_PER_1000_CHARS
  return Math.min(TRANSLATION_TIMEOUT_MAX_MS, scaled)
}

/**
 * Ruft den Template-Transformer mit laengenabhaengiger Zeitgrenze auf. Laeuft
 * sie ab, nennt die Meldung Grenze und Textmenge — im Job stand bisher nur
 * „Request timed out", und niemand sah, wie knapp die Grenze war.
 */
export async function callTranslationTransform(
  params: Omit<TemplateTransformParams, 'timeoutMs'>,
): Promise<Response> {
  const timeoutMs = translationTimeoutMs(params.text.length)
  try {
    return await callTemplateTransform({ ...params, timeoutMs })
  } catch (e) {
    if (e instanceof TimeoutError) {
      throw new TimeoutError(
        `Uebersetzung nach ${Math.round(timeoutMs / 1000)} s abgebrochen ` +
          `(${params.text.length} Zeichen; Zeitgrenze waechst mit der Textlaenge, hoechstens ` +
          `${TRANSLATION_TIMEOUT_MAX_MS / 1000} s)`,
      )
    }
    throw e
  }
}
