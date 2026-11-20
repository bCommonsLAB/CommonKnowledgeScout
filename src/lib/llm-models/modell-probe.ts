/**
 * @fileoverview Probefrage an ein Modell — derselbe Weg wie eine echte Antwort.
 *
 * @description
 * Schickt eine Mini-Frage ueber den Secretary (`/api/transformer/chat`) an das
 * Modell, ohne Secretary-Cache. Klappt sie, ist belegt: der Secretary kennt
 * den Anbieter, OpenRouter kennt das Modell, und es liefert Text. Kosten:
 * ein Bruchteil eines Cents. Ein Fehler wird nicht verschluckt, sondern als
 * Ergebnis gespeichert und angezeigt.
 *
 * @module llm-models
 */

import { callLlmText } from '@/lib/chat/common/llm'
import type { ModellProbe } from '@/types/sprachmodell'

const FRAGE = 'Antworte nur mit dem Wort OK.'
/** Grosszuegig, weil Modelle mit Denkphase Token vor der Antwort verbrauchen. */
const MAX_TOKENS = 1000

export async function probiereModell(modelId: string): Promise<ModellProbe> {
  const start = Date.now()
  const at = new Date(start).toISOString()
  try {
    const ergebnis = await callLlmText({
      model: modelId,
      temperature: 0,
      maxTokens: MAX_TOKENS,
      useCache: false,
      messages: [{ role: 'user', content: FRAGE }],
    })
    const ms = Date.now() - start
    const text = ergebnis.text.trim()
    if (!text) return { ok: false, at, ms, fehler: 'Das Modell hat leeren Text geliefert' }
    return { ok: true, at, ms, antwort: text.slice(0, 80) }
  } catch (error) {
    const fehler = error instanceof Error ? error.message : String(error)
    console.error('[modell-probe] Probe fehlgeschlagen:', modelId, fehler)
    return { ok: false, at, ms: Date.now() - start, fehler: fehler.slice(0, 500) }
  }
}
