/**
 * @fileoverview Token-Verbrauch und Kosten aus der Antwort des Secretary lesen.
 *
 * Seit 10.11.2026 liefert `/api/transformer/chat` auf oberster Ebene `usage`
 * (model, prompt_tokens, completion_tokens, total_tokens, cost, cost_currency).
 * Aeltere Secretary-Staende kennen nur `process.llm_info` mit der Summe —
 * dann bleiben Aufteilung und Kosten leer (nicht 0, nicht geschaetzt).
 */

import type { LlmUsage } from './llm'

interface SecretaryUsageAntwort {
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown; cost?: unknown; cost_currency?: unknown }
  process?: { llm_info?: { total_tokens?: unknown; requests?: Array<{ tokens?: unknown }> } }
}

function zahl(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

export function usageAusSecretaryAntwort(antwort: unknown): LlmUsage | undefined {
  if (typeof antwort !== 'object' || antwort === null) return undefined
  const { usage: u, process: p } = antwort as SecretaryUsageAntwort
  const info = p?.llm_info
  if (!u && !info) return undefined

  // Summe: einzelne Requests vor der gemeldeten Gesamtzahl (bisheriges Verhalten), dann `usage`.
  const ausRequests = (info?.requests ?? []).reduce((summe, r) => summe + (zahl(r.tokens) ?? 0), 0)
  const totalTokens = ausRequests > 0 ? ausRequests : zahl(info?.total_tokens) ?? zahl(u?.total_tokens)

  const usage: LlmUsage = { totalTokens }
  if (u) {
    usage.promptTokens = zahl(u.prompt_tokens)
    usage.completionTokens = zahl(u.completion_tokens)
    // `cost: null` heisst ausdruecklich „ohne Preis" und bleibt null; fehlt das Feld, bleibt es undefined.
    if (u.cost === null) usage.cost = null
    else if (zahl(u.cost) !== undefined) usage.cost = zahl(u.cost)
    if (typeof u.cost_currency === 'string') usage.costCurrency = u.cost_currency
  }
  return usage
}
