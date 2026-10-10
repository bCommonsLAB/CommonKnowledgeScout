/**
 * @fileoverview Korrektur-Assistent: Vorschlaege fuer Hoerfehler und Sprecherwechsel holen.
 *
 * @description
 * Ersetzt den festen Secretary-Endpunkt `transcript/korrekturvorschlag` fuer
 * die Korrektur-Ansicht: Der Auftrag ist sichtbar und editierbar
 * (`STANDARD_AUFTRAG`), die Eingabe sind die nummerierten Saetze des letzten
 * Transkriptions-Laufs, die Antwort wird gegen den Text geprueft
 * (`pruefeAssistentAntwort`). Der LLM-Aufruf geht wie ueberall in KS ueber
 * `callLlmJson` (Secretary `transformer/chat`); das JSON-Format steht im Prompt
 * (Secretary erzwingt schema_json nicht).
 *
 * @module transkript-korrektur
 */

import { z } from 'zod'
import { callLlmJson } from '@/lib/chat/common/llm'
import { getDefaultLlmModel } from '@/lib/db/llm-models-repo'
import { baueAssistentNachricht, type AssistentBegleittext, type AssistentSatz } from './assistent-auftrag'
import { pruefeAssistentAntwort, type AssistentErgebnis } from './assistent-pruefung'

/** Grenze fuer Saetze + Begleittexte (Zeichen) — vorab gemessen, damit die Meldung die Zahl nennt. */
export const ASSISTENT_MAX_ZEICHEN = 600_000

const antwortSchema = z.object({
  korrekturen: z.array(z.unknown()).default([]),
  sprecher: z.array(z.unknown()).default([]),
})

const antwortSchemaJson = JSON.stringify({
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: { korrekturen: { type: 'array' }, sprecher: { type: 'array' } },
  required: ['korrekturen', 'sprecher'],
})

export interface AssistentLauf extends AssistentErgebnis {
  modell: string
  tokens: number | null
  dauerMs: number
}

export async function holeAssistentVorschlaege(args: {
  auftrag: string
  saetze: readonly AssistentSatz[]
  begleittexte: readonly AssistentBegleittext[]
  bekannteNamen: readonly string[]
}): Promise<AssistentLauf> {
  const model = (await getDefaultLlmModel())?.modelId
  if (!model) throw new Error('Kein LLM-Modell konfiguriert (llm_models leer) — Vorschlaege nicht moeglich')
  const start = Date.now()
  const { data, usage } = await callLlmJson(
    {
      model,
      temperature: 0.2,
      responseFormat: { type: 'json_object' },
      messages: [{ role: 'user', content: baueAssistentNachricht(args) }],
    },
    antwortSchema,
    antwortSchemaJson,
  )
  const geprueft = pruefeAssistentAntwort(data, args.saetze, args.begleittexte, args.bekannteNamen)
  return { ...geprueft, modell: model, tokens: usage?.totalTokens ?? null, dauerMs: Date.now() - start }
}
